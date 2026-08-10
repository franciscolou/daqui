import time

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core import geocoding
from app.core.geocoding import GeoResult
from app.daos import geo_cache as geo_cache_dao
from app.models.geo_cache import GeoCacheKind
from app.schemas.geo import GeocodeResult, NearbyNeighborhood, NeighborhoodResolution


def _norm(value: str) -> str:
    return (value or "").strip().lower()


# Cache em memória dos bairros vizinhos por ponto. O Overpass é lento (~25s de
# timeout) e limitado por taxa, então não pode rodar a cada carga de feed. A
# chave arredonda lat/lng em 2 casas (~1km) e o valor expira em 6h.
_NEARBY_TTL = 6 * 60 * 60
_nearby_cache: dict[tuple[float, float], tuple[float, list[str]]] = {}


def neighborhoods_around(latitude: float, longitude: float) -> list[str]:
    """Nomes dos bairros vizinhos ao ponto (para o feed 'incluir redondezas').

    Reusa `geocoding.nearby` (OSM/Overpass) com cache por ponto. Tolerante a
    falha: devolve [] se o Overpass não responder.
    """
    key = (round(latitude, 2), round(longitude, 2))
    now = time.monotonic()
    cached = _nearby_cache.get(key)
    if cached and now - cached[0] < _NEARBY_TTL:
        return cached[1]
    places = geocoding.nearby(latitude, longitude)
    names = [p["neighborhood"] for p in places if p["neighborhood"]]
    _nearby_cache[key] = (now, names)
    return names


# Cache persistente (banco, `geo_cache`) para geocode/search/reverse — ao
# contrário do `_nearby_cache` acima (em memória, protege uma chamada grátis
# ao Overpass), este protege a cota do provedor pago (HERE, ver
# core/geocoding/router.py) e sobrevive a restart do backend. Endereço e
# mapeamento prédio→bairro são quase estáticos, por isso um TTL longo (60
# dias) é seguro — resultado negativo (endereço não encontrado) NUNCA é
# cacheado em nenhum dos 3 call sites abaixo, pra uma falha pontual do
# provedor não bloquear em silêncio um endereço real por 60 dias.
_GEO_CACHE_TTL = 60 * 24 * 60 * 60

# TTL curto para resultado DEGRADADO: a query pedia número de casa (portanto o
# HERE deveria ter respondido) mas nenhuma sugestão dele entrou — chave recém
# configurada, cota estourada, timeout. Guardar isso por 60 dias esconderia o
# número de casa até 2026 mesmo depois de o HERE voltar; guardar por 10min
# ainda protege contra uma rajada de teclas e se recupera sozinho.
_GEO_CACHE_TTL_DEGRADED = 10 * 60


def _cache_get(db: Session, kind: GeoCacheKind, cache_key: str):
    row = geo_cache_dao.get(db, kind, cache_key)
    return row.payload if row else None


def _cache_put(
    db: Session, kind: GeoCacheKind, cache_key: str, payload, provider: str, ttl: int | None = None
) -> None:
    geo_cache_dao.upsert(db, kind, cache_key, payload, provider, ttl or _GEO_CACHE_TTL)


def resolve_neighborhood(latitude: float, longitude: float, db: Session) -> NeighborhoodResolution:
    """Descobre o bairro a partir das coordenadas do dispositivo.

    Chave do cache arredonda lat/lng em 4 casas (~11m, grid do tamanho de um
    lote): fino o bastante pra nunca misturar bairros diferentes (ao
    contrário das 2 casas do `_nearby_cache`, que seriam coarse demais aqui),
    mas ainda captura o caso comum de reabrir o app quase no mesmo ponto.
    """
    cache_key = f"{round(latitude, 4)},{round(longitude, 4)}"
    if cached := _cache_get(db, GeoCacheKind.REVERSE, cache_key):
        return NeighborhoodResolution(**cached)

    result = geocoding.reverse(latitude, longitude)
    if not result or not result["neighborhood"]:
        raise HTTPException(
            status_code=422,
            detail="Não conseguimos identificar seu bairro. Tente novamente em instantes.",
        )
    resolution = NeighborhoodResolution(
        neighborhood=result["neighborhood"],
        city=result["city"] or "São Paulo",
        state=result["state"] or "SP",
        display_name=result["display_name"],
        latitude=result["latitude"],
        longitude=result["longitude"],
    )
    _cache_put(db, GeoCacheKind.REVERSE, cache_key, resolution.model_dump(), provider=result["provider"])
    return resolution


def nearby_neighborhoods(latitude: float, longitude: float) -> list[NearbyNeighborhood]:
    """Bairros nas redondezas do ponto (fronteiriços), para o usuário escolher
    quando o bairro detectado não for o dele."""
    places = geocoding.nearby(latitude, longitude)
    return [NearbyNeighborhood(**place) for place in places]


def geocode_within(address: str, neighborhood: str, db: Session) -> GeoResult:
    """Geocodifica um endereço e garante que ele está dentro do bairro.

    Levanta 400 se o endereço não for encontrado ou pertencer a outro bairro.
    Fica só no Nominatim (nunca escala pro HERE) — este fluxo valida um
    endereço já fechado (ex.: rótulo de uma sugestão do autocomplete), não é
    onde a interpolação de número faz diferença.
    """
    address = (address or "").strip()
    if not address:
        raise HTTPException(status_code=400, detail="Informe um endereço.")

    cache_key = f"{_norm(neighborhood)}|{_norm(address)}"
    if cached := _cache_get(db, GeoCacheKind.FORWARD, cache_key):
        return cached

    # Ajuda o Nominatim acrescentando o bairro à busca quando ele não foi digitado.
    query = address if _norm(neighborhood) in _norm(address) else f"{address}, {neighborhood}"
    result = geocoding.forward(query)
    if not result:
        raise HTTPException(status_code=400, detail="Endereço não encontrado.")

    if _norm(result["neighborhood"]) != _norm(neighborhood):
        raise HTTPException(
            status_code=400,
            detail=f"Este endereço não fica em {neighborhood}. Só é possível marcar locais do seu bairro.",
        )
    _cache_put(db, GeoCacheKind.FORWARD, cache_key, dict(result), provider=result["provider"])
    return result


def search(query: str, db: Session, limit: int = 6) -> list[GeocodeResult]:
    """Sugestões de endereço pro pin do anúncio (autocomplete do painel de
    anúncios) — ao contrário de `search_within`, sem filtro de bairro: um
    anúncio pode ficar em qualquer lugar do Brasil, e quem busca é um
    AdAdmin (sem bairro próprio), não um User do app."""
    query = (query or "").strip()
    if not query:
        return []

    cache_key = f"{_norm(query)}|{limit}"
    if cached := _cache_get(db, GeoCacheKind.SEARCH, cache_key):
        return [GeocodeResult(**item) for item in cached]

    results = geocoding.search(query, limit=limit)

    # Mesmo dedupe de search_within: o rótulo enxuto (sem CEP) pode repetir
    # pra pontos distintos do OSM; sem o CEP pra diferenciar, mostrar os dois
    # seria só ruído.
    seen: set[str] = set()
    deduped: list[GeoResult] = []
    for r in results:
        key = _norm(r["display_name"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)

    final = deduped[:limit]
    payload = [
        {"latitude": r["latitude"], "longitude": r["longitude"], "label": r["display_name"]}
        for r in final
    ]
    if payload:  # lista vazia nunca é cacheada — mesma razão de search_within
        providers = sorted({r["provider"] for r in final})
        degraded = geocoding.expects_here(query) and "here" not in providers
        _cache_put(
            db,
            GeoCacheKind.SEARCH,
            cache_key,
            payload,
            provider="+".join(providers),
            ttl=_GEO_CACHE_TTL_DEGRADED if degraded else None,
        )
    return [GeocodeResult(**item) for item in payload]


def geocode(address: str, neighborhood: str, db: Session) -> GeocodeResult:
    result = geocode_within(address, neighborhood, db)
    return GeocodeResult(
        latitude=result["latitude"],
        longitude=result["longitude"],
        label=result["display_name"],
    )


def search_within(query: str, neighborhood: str, db: Session, limit: int = 5) -> list[GeocodeResult]:
    """Sugestões de endereço (autocomplete, tipo iFood/Uber) enquanto o usuário
    digita, já filtradas pro bairro dele.

    Ao contrário de `geocode`, que valida um endereço já fechado, isto devolve
    várias opções pra escolher — cada uma sai do filtro já confirmada dentro do
    bairro, então escolher uma delas dispensa geocodificar de novo depois.

    `geocoding.search()` já decide sozinho (core/geocoding/router.py) se vale
    escalar pro HERE — aqui só cacheia o resultado final, sem saber/se importar
    qual provedor respondeu.
    """
    query = (query or "").strip()
    if not query:
        return []

    cache_key = f"{_norm(neighborhood)}|{_norm(query)}|{limit}"
    if cached := _cache_get(db, GeoCacheKind.SEARCH, cache_key):
        return [GeocodeResult(**item) for item in cached]

    # Mesmo truque do geocode_within: acrescenta o bairro à busca quando o
    # usuário ainda não digitou, pra ajudar o provedor a desambiguar.
    biased = query if _norm(neighborhood) in _norm(query) else f"{query}, {neighborhood}"
    results = geocoding.search(biased, limit=limit * 3)
    matches = [r for r in results if _norm(r["neighborhood"]) == _norm(neighborhood)]

    # O rótulo enxuto (sem CEP) pode ficar igual pra pontos distintos do OSM
    # (ex.: mesma rua em duas faixas de CEP) — sem o CEP pra diferenciar,
    # mostrar as duas seria só ruído, então fica a primeira. Como o HERE (se
    # escalado) vem primeiro na lista, uma sugestão sua com número exato ganha
    # do resultado genérico do Nominatim pro mesmo endereço.
    seen: set[str] = set()
    deduped: list[GeoResult] = []
    for r in matches:
        key = _norm(r["display_name"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)

    final = deduped[:limit]
    payload = [
        {"latitude": r["latitude"], "longitude": r["longitude"], "label": r["display_name"]}
        for r in final
    ]
    if payload:  # lista vazia nunca é cacheada — ver comentário no topo do arquivo
        providers = sorted({r["provider"] for r in final})
        # Sem HERE numa busca que pedia número de casa, o resultado é degradado
        # (ver `_GEO_CACHE_TTL_DEGRADED`) — vale pouco tempo, não 60 dias.
        degraded = geocoding.expects_here(query) and "here" not in providers
        _cache_put(
            db,
            GeoCacheKind.SEARCH,
            cache_key,
            payload,
            provider="+".join(providers),
            ttl=_GEO_CACHE_TTL_DEGRADED if degraded else None,
        )
    return [GeocodeResult(**item) for item in payload]

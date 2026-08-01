from sqlalchemy.orm import Session

from app.core import geocoding
from app.daos import geo_cache as geo_cache_dao
from app.models.geo_cache import GeoCacheKind
from app.schemas.geo import GeocodeResult


def _norm(value: str) -> str:
    return (value or "").strip().lower()


# Igual ao backend principal (backend/app/services/geo.py): endereço é quase
# estático, então um TTL longo é seguro — resultado vazio nunca é cacheado
# (ver comentário mais abaixo), então o risco fica limitado a "resposta
# correta um pouco antiga", nunca "resposta errada por falha transitória".
_GEO_CACHE_TTL = 60 * 24 * 60 * 60

# TTL curto para resultado DEGRADADO — mesma regra do backend principal: a
# query pedia número de casa (portanto o HERE deveria ter respondido) mas
# nenhuma sugestão dele entrou (chave recém configurada, cota estourada,
# timeout). Guardar isso com o TTL longo esconderia o número de casa por 60
# dias mesmo depois de o HERE voltar.
_GEO_CACHE_TTL_DEGRADED = 10 * 60


def search(query: str, db: Session, limit: int = 6) -> list[GeocodeResult]:
    """Sugestões de endereço pro pin do anúncio (autocomplete) — ao contrário
    do backend principal, sem filtro de bairro: um anúncio pode ficar em
    qualquer lugar do Brasil, não só no bairro de quem está logado (que aqui
    nem existe — só há admins, sem bairro próprio)."""
    query = (query or "").strip()
    if not query:
        return []

    cache_key = f"{_norm(query)}|{limit}"
    if cached := geo_cache_dao.get(db, GeoCacheKind.SEARCH, cache_key):
        return [GeocodeResult(**item) for item in cached.payload]

    results = geocoding.search(query, limit=limit)

    # Mesmo dedupe por label do backend principal — o rótulo enxuto (sem CEP)
    # pode repetir pra pontos distintos do OSM; sem o CEP pra diferenciar,
    # mostrar os dois seria só ruído.
    seen: set[str] = set()
    deduped = []
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
    if payload:  # resultado vazio nunca é cacheado — mesma razão do backend principal
        providers = sorted({r["provider"] for r in final})
        degraded = geocoding.expects_here(query) and "here" not in providers
        geo_cache_dao.upsert(
            db,
            GeoCacheKind.SEARCH,
            cache_key,
            payload,
            provider="+".join(providers),
            ttl_seconds=_GEO_CACHE_TTL_DEGRADED if degraded else _GEO_CACHE_TTL,
        )
    return [GeocodeResult(**item) for item in payload]

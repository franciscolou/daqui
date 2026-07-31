"""Cliente do Nominatim (OpenStreetMap) para geocodificação.

Grátis e sem API key. Regras de uso do Nominatim: User-Agent identificável e no
máximo ~1 req/s. Aqui usamos apenas em pontos de baixo volume (cadastro, criação
de post). As funções são tolerantes a falha: devolvem None em vez de estourar,
deixando a decisão de negócio para a camada de service.
"""
from __future__ import annotations

import math

import httpx

from .types import STATE_UF, GeoResult, NearbyPlace

NOMINATIM_URL = "https://nominatim.openstreetmap.org"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "Daqui/1.0 (rede social de bairro)"
TIMEOUT = 8.0
# Overpass costuma ser mais lento; damos uma folga maior no timeout.
OVERPASS_TIMEOUT = 25.0

# Chaves do `address` do Nominatim que, em ordem, representam o "bairro".
NEIGHBORHOOD_KEYS = ("suburb", "neighbourhood", "city_district", "quarter", "borough")
CITY_KEYS = ("city", "town", "municipality", "village")


def _pick(address: dict, keys: tuple[str, ...]) -> str:
    for key in keys:
        value = address.get(key)
        if value:
            return str(value)
    return ""


def _uf(address: dict) -> str:
    iso = str(address.get("ISO3166-2-lvl4", ""))
    if iso.startswith("BR-"):
        return iso.split("-", 1)[1]
    return STATE_UF.get(str(address.get("state", "")).strip().lower(), "")


# Chaves do `address` do Nominatim que representam a via (rua/avenida/etc).
STREET_KEYS = ("road", "pedestrian", "footway", "cycleway")


def _label(address: dict, neighborhood: str, city: str) -> str:
    """Monta um rótulo enxuto — Rua[, número], Bairro, Cidade, País — a partir
    dos campos estruturados do Nominatim, em vez do `display_name` bruto (que
    vem com UF, "Região X" e CEP, que não queremos mostrar).

    O número só aparece quando o próprio OSM tem aquele endereço mapeado como
    ponto (nem toda rua tem cada número indexado — limitação dos dados, não da
    busca: ver core/geocoding/router.py, que escala pro HERE nesse caso).
    """
    street = _pick(address, STREET_KEYS)
    house_number = address.get("house_number")
    if street and house_number:
        street = f"{street}, {house_number}"
    country = str(address.get("country") or "Brasil")
    parts = [p for p in (street, neighborhood, city, country) if p]
    return ", ".join(parts)


def _to_result(item: dict) -> GeoResult | None:
    address = item.get("address") or {}
    neighborhood = _pick(address, NEIGHBORHOOD_KEYS)
    city = _pick(address, CITY_KEYS)
    try:
        lat = float(item["lat"])
        lon = float(item["lon"])
    except (KeyError, TypeError, ValueError):
        return None
    return GeoResult(
        latitude=lat,
        longitude=lon,
        neighborhood=neighborhood,
        city=city,
        state=_uf(address),
        display_name=_label(address, neighborhood, city),
        provider="nominatim",
    )


def _get(path: str, params: dict) -> dict | list | None:
    try:
        resp = httpx.get(
            f"{NOMINATIM_URL}{path}",
            params={**params, "format": "jsonv2", "addressdetails": 1},
            headers={"User-Agent": USER_AGENT},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except (httpx.HTTPError, ValueError):
        return None


def reverse(lat: float, lon: float) -> GeoResult | None:
    """Coordenadas → bairro/cidade (reverse geocoding)."""
    data = _get("/reverse", {"lat": lat, "lon": lon, "zoom": 18})
    if not isinstance(data, dict):
        return None
    return _to_result(data)


def forward(query: str) -> GeoResult | None:
    """Endereço (texto) → coordenadas + bairro (forward geocoding)."""
    data = _get("/search", {"q": query, "countrycodes": "br", "limit": 1})
    if not isinstance(data, list) or not data:
        return None
    return _to_result(data[0])


def search(query: str, limit: int = 10) -> list[GeoResult]:
    """Endereço (texto) → várias sugestões de coordenadas + bairro (autocomplete,
    tipo iFood/Uber): usado enquanto o usuário digita, ao contrário de `forward`
    (que só devolve o melhor resultado, pra validar um endereço já fechado)."""
    data = _get("/search", {"q": query, "countrycodes": "br", "limit": limit})
    if not isinstance(data, list):
        return []
    return [r for item in data if (r := _to_result(item)) is not None]


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distância aproximada em metros entre dois pontos."""
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# Tipos de `place` no OSM que representam um bairro/vizinhança.
PLACE_KINDS = "suburb|neighbourhood|quarter|city_district|borough"


def nearby(lat: float, lon: float, radius: int = 3000, limit: int = 12) -> list[NearbyPlace]:
    """Bairros vizinhos ao ponto, via Overpass (OSM).

    Busca, numa única requisição, os nós de bairro num raio ao redor das
    coordenadas e devolve os mais próximos (distintos por nome), ordenados por
    distância. Tolerante a falha: devolve [] se o Overpass não responder.
    """
    query = (
        f"[out:json][timeout:20];"
        f'node(around:{radius},{lat},{lon})["place"~"^({PLACE_KINDS})$"]["name"];'
        f"out body;"
    )
    try:
        resp = httpx.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": USER_AGENT},
            timeout=OVERPASS_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError):
        return []

    scored: list[tuple[float, NearbyPlace]] = []
    seen: set[str] = set()
    for el in data.get("elements", []) if isinstance(data, dict) else []:
        name = (el.get("tags") or {}).get("name")
        if not name:
            continue
        key = str(name).strip().lower()
        if key in seen:
            continue
        try:
            elat = float(el["lat"])
            elon = float(el["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        seen.add(key)
        dist = _haversine(lat, lon, elat, elon)
        scored.append(
            (dist, NearbyPlace(neighborhood=str(name), latitude=elat, longitude=elon, distance_m=dist))
        )

    scored.sort(key=lambda t: t[0])
    return [place for _, place in scored[:limit]]

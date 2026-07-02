"""Cliente do Nominatim (OpenStreetMap) para geocodificação.

Grátis e sem API key. Regras de uso do Nominatim: User-Agent identificável e no
máximo ~1 req/s. Aqui usamos apenas em pontos de baixo volume (cadastro, criação
de post). As funções são tolerantes a falha: devolvem None em vez de estourar,
deixando a decisão de negócio para a camada de service.
"""
from __future__ import annotations

import math
from typing import Optional, TypedDict

import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "Daqui/1.0 (rede social de bairro)"
TIMEOUT = 8.0
# Overpass costuma ser mais lento; damos uma folga maior no timeout.
OVERPASS_TIMEOUT = 25.0

# Chaves do `address` do Nominatim que, em ordem, representam o "bairro".
NEIGHBORHOOD_KEYS = ("suburb", "neighbourhood", "city_district", "quarter", "borough")
CITY_KEYS = ("city", "town", "municipality", "village")


# Nome completo do estado → sigla (UF), usado como fallback quando falta o ISO.
STATE_UF = {
    "acre": "AC", "alagoas": "AL", "amapá": "AP", "amazonas": "AM", "bahia": "BA",
    "ceará": "CE", "distrito federal": "DF", "espírito santo": "ES", "goiás": "GO",
    "maranhão": "MA", "mato grosso": "MT", "mato grosso do sul": "MS",
    "minas gerais": "MG", "pará": "PA", "paraíba": "PB", "paraná": "PR",
    "pernambuco": "PE", "piauí": "PI", "rio de janeiro": "RJ",
    "rio grande do norte": "RN", "rio grande do sul": "RS", "rondônia": "RO",
    "roraima": "RR", "santa catarina": "SC", "são paulo": "SP", "sergipe": "SE",
    "tocantins": "TO",
}


class GeoResult(TypedDict):
    latitude: float
    longitude: float
    neighborhood: str
    city: str
    state: str  # UF (2 letras)
    display_name: str


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


def _to_result(item: dict) -> Optional[GeoResult]:
    address = item.get("address") or {}
    neighborhood = _pick(address, NEIGHBORHOOD_KEYS)
    try:
        lat = float(item["lat"])
        lon = float(item["lon"])
    except (KeyError, TypeError, ValueError):
        return None
    return GeoResult(
        latitude=lat,
        longitude=lon,
        neighborhood=neighborhood,
        city=_pick(address, CITY_KEYS),
        state=_uf(address),
        display_name=str(item.get("display_name", "")),
    )


def _get(path: str, params: dict) -> Optional[dict | list]:
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


def reverse(lat: float, lon: float) -> Optional[GeoResult]:
    """Coordenadas → bairro/cidade (reverse geocoding)."""
    data = _get("/reverse", {"lat": lat, "lon": lon, "zoom": 18})
    if not isinstance(data, dict):
        return None
    return _to_result(data)


def forward(query: str) -> Optional[GeoResult]:
    """Endereço (texto) → coordenadas + bairro (forward geocoding)."""
    data = _get("/search", {"q": query, "countrycodes": "br", "limit": 1})
    if not isinstance(data, list) or not data:
        return None
    return _to_result(data[0])


class NearbyPlace(TypedDict):
    neighborhood: str
    latitude: float
    longitude: float


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
        scored.append(
            (_haversine(lat, lon, elat, elon), NearbyPlace(neighborhood=str(name), latitude=elat, longitude=elon))
        )

    scored.sort(key=lambda t: t[0])
    return [place for _, place in scored[:limit]]

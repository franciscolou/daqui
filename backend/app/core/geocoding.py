"""Cliente do Nominatim (OpenStreetMap) para geocodificação.

Grátis e sem API key. Regras de uso do Nominatim: User-Agent identificável e no
máximo ~1 req/s. Aqui usamos apenas em pontos de baixo volume (cadastro, criação
de post). As funções são tolerantes a falha: devolvem None em vez de estourar,
deixando a decisão de negócio para a camada de service.
"""
from __future__ import annotations

from typing import Optional, TypedDict

import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org"
USER_AGENT = "Daqui/1.0 (rede social de bairro)"
TIMEOUT = 8.0

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

"""Cliente do HERE Geocoding & Search API v7 — usado só como escalada pontual
de `nominatim.search()` (ver `router.py`), quando o texto digitado já parece
ter um número de casa: o Nominatim frequentemente não tem esse número indexado
(lacuna de dado do OSM em ruas residenciais), o HERE costuma ter melhor
interpolação. Igual ao `nominatim.py`: tolerante a falha, nunca levanta.

`HERE_API_KEY` vazia (padrão) desativa o cliente antes de qualquer request —
ver `core/config.py`.
"""
from __future__ import annotations

import httpx

from app.core.config import HERE_TIMEOUT_SECONDS, settings

from .types import STATE_UF, GeoResult

GEOCODE_URL = "https://geocode.search.hereapi.com/v1/geocode"

# Campos do `address` do HERE mais próximos de "bairro" em endereços BR.
# Não confirmado em documentação oficial pra todo endereço BR — validar com
# uma chave real (ver seção de verificação do plano) e ajustar se necessário.
NEIGHBORHOOD_KEYS = ("district", "subdistrict")


def _pick(address: dict, keys: tuple[str, ...]) -> str:
    for key in keys:
        value = address.get(key)
        if value:
            return str(value)
    return ""


def _uf(address: dict) -> str:
    return STATE_UF.get(str(address.get("state", "")).strip().lower(), "")


def _label(address: dict, neighborhood: str, city: str) -> str:
    street = str(address.get("street") or "")
    house_number = address.get("houseNumber")
    if street and house_number:
        street = f"{street}, {house_number}"
    country = str(address.get("countryName") or "Brasil")
    parts = [p for p in (street, neighborhood, city, country) if p]
    return ", ".join(parts)


def _to_result(item: dict) -> GeoResult | None:
    address = item.get("address") or {}
    position = item.get("position") or {}
    neighborhood = _pick(address, NEIGHBORHOOD_KEYS)
    city = str(address.get("city") or "")
    try:
        lat = float(position["lat"])
        lon = float(position["lng"])
    except (KeyError, TypeError, ValueError):
        return None
    return GeoResult(
        latitude=lat,
        longitude=lon,
        neighborhood=neighborhood,
        city=city,
        state=_uf(address),
        display_name=_label(address, neighborhood, city),
        provider="here",
    )


def search(query: str, limit: int = 10) -> list[GeoResult]:
    """Endereço (texto) → sugestões, via HERE Geocode (não Autosuggest — ver
    router.py sobre por quê). Só chamado quando `settings.HERE_API_KEY` está
    configurada."""
    if not settings.HERE_API_KEY:
        return []
    try:
        resp = httpx.get(
            GEOCODE_URL,
            params={
                "q": query,
                "in": "countryCode:BRA",
                "limit": limit,
                "apiKey": settings.HERE_API_KEY,
            },
            timeout=HERE_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError):
        return []
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list):
        return []
    return [r for item in items if (r := _to_result(item)) is not None]

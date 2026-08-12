"""Geocodificação: mesma API pública de quando isto era um único módulo
(`core/geocoding.py`) — `services/geo.py` e os scripts de seed continuam
fazendo `from app.core import geocoding; geocoding.search(...)` sem mudanças.

`forward`/`nearby` seguem só-Nominatim (sem HERE equivalente pro `nearby`, e
`forward` valida endereço já fechado — não é onde a interpolação de número
faz diferença, ver `services/geo.py::geocode_within`); `search` e `reverse`
são roteados (ver `router.py`) e escalam pro HERE quando configurado.
"""
from .nominatim import forward, nearby
from .router import expects_here, reverse, search
from .types import GeoResult, NearbyPlace

__all__ = ["expects_here", "forward", "nearby", "reverse", "search", "GeoResult", "NearbyPlace"]

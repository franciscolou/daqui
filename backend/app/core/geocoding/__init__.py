"""Geocodificação: mesma API pública de quando isto era um único módulo
(`core/geocoding.py`) — `services/geo.py` e os scripts de seed continuam
fazendo `from app.core import geocoding; geocoding.search(...)` sem mudanças.

`forward`/`reverse`/`nearby` seguem só-Nominatim; `search` é a única função
roteada (ver `router.py`), pois é o único fluxo (autocomplete) onde vale
escalar para o HERE.
"""
from .nominatim import forward, nearby, reverse
from .router import expects_here, search
from .types import GeoResult, NearbyPlace

__all__ = ["expects_here", "forward", "nearby", "reverse", "search", "GeoResult", "NearbyPlace"]

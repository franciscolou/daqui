import time

from fastapi import HTTPException

from app.core import geocoding
from app.core.geocoding import GeoResult
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


def resolve_neighborhood(latitude: float, longitude: float) -> NeighborhoodResolution:
    """Descobre o bairro a partir das coordenadas do dispositivo."""
    result = geocoding.reverse(latitude, longitude)
    if not result or not result["neighborhood"]:
        raise HTTPException(
            status_code=422,
            detail="Não conseguimos identificar seu bairro. Tente novamente em instantes.",
        )
    return NeighborhoodResolution(
        neighborhood=result["neighborhood"],
        city=result["city"] or "São Paulo",
        state=result["state"] or "SP",
        display_name=result["display_name"],
        latitude=result["latitude"],
        longitude=result["longitude"],
    )


def nearby_neighborhoods(latitude: float, longitude: float) -> list[NearbyNeighborhood]:
    """Bairros nas redondezas do ponto (fronteiriços), para o usuário escolher
    quando o bairro detectado não for o dele."""
    places = geocoding.nearby(latitude, longitude)
    return [NearbyNeighborhood(**place) for place in places]


def geocode_within(address: str, neighborhood: str) -> GeoResult:
    """Geocodifica um endereço e garante que ele está dentro do bairro.

    Levanta 400 se o endereço não for encontrado ou pertencer a outro bairro.
    """
    address = (address or "").strip()
    if not address:
        raise HTTPException(status_code=400, detail="Informe um endereço.")

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
    return result


def geocode(address: str, neighborhood: str) -> GeocodeResult:
    result = geocode_within(address, neighborhood)
    return GeocodeResult(
        latitude=result["latitude"],
        longitude=result["longitude"],
        label=result["display_name"],
    )

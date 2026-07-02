from fastapi import HTTPException

from app.core import geocoding
from app.core.geocoding import GeoResult
from app.schemas.geo import GeocodeResult, NeighborhoodResolution


def _norm(value: str) -> str:
    return (value or "").strip().lower()


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

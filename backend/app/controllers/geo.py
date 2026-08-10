from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_ad_admin, get_current_user, get_db
from app.models.ad_admin import AdAdmin
from app.models.user import User
from app.schemas.geo import (
    GeocodeRequest,
    GeocodeResult,
    NearbyNeighborhood,
    NearbyNeighborhoodsRequest,
    NeighborhoodResolution,
    ResolveNeighborhoodRequest,
    SearchRequest,
)
from app.services import geo


def resolve_neighborhood(
    payload: ResolveNeighborhoodRequest, db: Session = Depends(get_db)
) -> NeighborhoodResolution:
    # Público: usado no cadastro, antes de existir conta/token.
    return geo.resolve_neighborhood(payload.latitude, payload.longitude, db)


def nearby_neighborhoods(payload: NearbyNeighborhoodsRequest) -> list[NearbyNeighborhood]:
    # Público: usado no cadastro para escolher um bairro vizinho.
    return geo.nearby_neighborhoods(payload.latitude, payload.longitude)


def geocode(
    payload: GeocodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GeocodeResult:
    return geo.geocode(payload.address, current_user.neighborhood, db)


def search_address(
    payload: SearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GeocodeResult]:
    return geo.search_within(payload.query, current_user.neighborhood, db)


def ads_search_address(
    payload: SearchRequest,
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_ad_admin),
) -> list[GeocodeResult]:
    # Admin-only: usado pelo ads-admin pra buscar o pin do anúncio (mapa) —
    # sem filtro de bairro, ao contrário de search_address acima.
    return geo.search(payload.query, db)

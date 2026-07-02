from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.geo import (
    GeocodeRequest,
    GeocodeResult,
    NeighborhoodResolution,
    ResolveNeighborhoodRequest,
)
from app.services import geo


def resolve_neighborhood(payload: ResolveNeighborhoodRequest) -> NeighborhoodResolution:
    # Público: usado no cadastro, antes de existir conta/token.
    return geo.resolve_neighborhood(payload.latitude, payload.longitude)


def geocode(
    payload: GeocodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GeocodeResult:
    return geo.geocode(payload.address, current_user.neighborhood)

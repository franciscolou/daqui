from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin, get_db
from app.models.admin import AdAdmin
from app.schemas.geo import GeocodeResult, SearchRequest
from app.services import geo as geo_service


def search_address(
    payload: SearchRequest,
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_admin),
) -> list[GeocodeResult]:
    return geo_service.search(payload.query, db)

from fastapi import APIRouter

from app.controllers import geo
from app.schemas.geo import GeocodeResult

# Admin-only: usado pelo ads-admin pra buscar o pin do anúncio (mapa).
admin_router = APIRouter(prefix="/geo", tags=["geo"])
admin_router.post("/search", response_model=list[GeocodeResult])(geo.search_address)

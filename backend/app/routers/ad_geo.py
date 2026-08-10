from fastapi import APIRouter

from app.controllers import geo
from app.schemas.geo import GeocodeResult

# Admin-only: usado pelo ads-admin pra buscar o pin do anúncio (mapa), sem a
# restrição de bairro de /geo/search (que é escopada ao User logado no app).
admin_router = APIRouter(prefix="/ads-admin/geo", tags=["ads-admin"])
admin_router.post("/search", response_model=list[GeocodeResult])(geo.ads_search_address)

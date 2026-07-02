from fastapi import APIRouter

from app.controllers import geo
from app.schemas.geo import GeocodeResult, NearbyNeighborhood, NeighborhoodResolution

router = APIRouter(prefix="/geo", tags=["geo"])

router.post("/resolve",  response_model=NeighborhoodResolution)(geo.resolve_neighborhood)
router.post("/nearby",   response_model=list[NearbyNeighborhood])(geo.nearby_neighborhoods)
router.post("/geocode",  response_model=GeocodeResult)(geo.geocode)

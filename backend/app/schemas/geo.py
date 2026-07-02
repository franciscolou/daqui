from pydantic import BaseModel, Field


class ResolveNeighborhoodRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class NeighborhoodResolution(BaseModel):
    neighborhood: str
    city: str
    state: str
    display_name: str
    latitude: float
    longitude: float


class GeocodeRequest(BaseModel):
    address: str


class GeocodeResult(BaseModel):
    latitude: float
    longitude: float
    label: str

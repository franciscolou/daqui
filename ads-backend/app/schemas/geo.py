from pydantic import BaseModel


class SearchRequest(BaseModel):
    query: str


class GeocodeResult(BaseModel):
    latitude: float
    longitude: float
    label: str

"""Tipos compartilhados entre os provedores de geocoding (`nominatim.py`, `here.py`)."""
from typing import TypedDict

# Nome completo do estado → sigla (UF), usado como fallback quando falta o ISO.
STATE_UF = {
    "acre": "AC", "alagoas": "AL", "amapá": "AP", "amazonas": "AM", "bahia": "BA",
    "ceará": "CE", "distrito federal": "DF", "espírito santo": "ES", "goiás": "GO",
    "maranhão": "MA", "mato grosso": "MT", "mato grosso do sul": "MS",
    "minas gerais": "MG", "pará": "PA", "paraíba": "PB", "paraná": "PR",
    "pernambuco": "PE", "piauí": "PI", "rio de janeiro": "RJ",
    "rio grande do norte": "RN", "rio grande do sul": "RS", "rondônia": "RO",
    "roraima": "RR", "santa catarina": "SC", "são paulo": "SP", "sergipe": "SE",
    "tocantins": "TO",
}


class GeoResult(TypedDict):
    latitude: float
    longitude: float
    neighborhood: str
    city: str
    state: str  # UF (2 letras)
    display_name: str
    # Qual provedor resolveu este resultado ("nominatim"/"here") — usado só
    # como metadado (cache/observabilidade), nunca entra em lógica de negócio.
    provider: str


class NearbyPlace(TypedDict):
    neighborhood: str
    latitude: float
    longitude: float
    distance_m: float

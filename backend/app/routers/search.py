from fastapi import APIRouter

from app.controllers import search
from app.schemas.search import SearchResults

router = APIRouter(prefix="/search", tags=["search"])

router.get("", response_model=SearchResults)(search.search_all)

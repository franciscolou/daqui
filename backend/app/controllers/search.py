from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.search import SearchResults
from app.services import search


def search_all(
    q: str = Query("", description="Termo de busca"),
    type: str = Query("all", description="all | posts | users"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SearchResults:
    return search.search(db, current_user, q, type)

from sqlalchemy.orm import Session

from app.daos import post as post_dao
from app.daos import user as user_dao
from app.models.user import User
from app.schemas.search import SearchResults
from app.services.post import _to_schema
from app.services.user import public_view

VALID_TYPES = {"all", "posts", "users"}


def search(db: Session, user: User, query: str, type_: str) -> SearchResults:
    query = query.strip()
    if type_ not in VALID_TYPES:
        type_ = "all"

    posts = []
    users = []
    if query:
        if type_ in ("all", "posts"):
            found = post_dao.search(db, user.neighborhood, query)
            posts = [_to_schema(p, user, db) for p in found]
        if type_ in ("all", "users"):
            # Usuários de outros bairros podem ser encontrados, mas vêm bloqueados.
            users = [public_view(user, u) for u in user_dao.search(db, query)]

    return SearchResults(posts=posts, users=users)

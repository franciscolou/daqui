from pydantic import BaseModel

from app.schemas.post import PostOut
from app.schemas.user import UserPublic


class SearchResults(BaseModel):
    posts: list[PostOut]
    users: list[UserPublic]

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.user import UserPublic


class TrashItemOut(BaseModel):
    id: int
    type: Literal["post", "comment"]
    content: str
    title: str | None = None
    created_at: datetime
    deleted_at: datetime
    expires_at: datetime
    author: UserPublic
    deleted_by: UserPublic


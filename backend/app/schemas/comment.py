from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserPublic


class CommentCreate(BaseModel):
    content: str


class CommentOut(BaseModel):
    id: int
    post_id: int
    content: str
    created_at: datetime
    author: UserPublic

    model_config = {"from_attributes": True}

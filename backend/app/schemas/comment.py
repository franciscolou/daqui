from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserPublic


class CommentCreate(BaseModel):
    content: str
    # Comentário respondido (thread). Nulo = comentário de topo.
    parent_id: int | None = None


class CommentOut(BaseModel):
    id: int
    post_id: int
    parent_id: int | None = None
    content: str
    created_at: datetime
    author: UserPublic
    likes_count: int = 0
    liked: bool = False
    replies_count: int = 0  # respostas diretas (carregadas sob demanda)

    model_config = {"from_attributes": True}

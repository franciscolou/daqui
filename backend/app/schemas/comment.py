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
    # True quando o bairro atual do autor é o mesmo do post comentado — selo de Morador.
    author_is_resident: bool = False
    likes_count: int = 0
    liked: bool = False
    reposts_count: int = 0
    reposted: bool = False  # repost simples (sem citação) pelo usuário logado
    replies_count: int = 0  # respostas diretas (carregadas sob demanda)

    model_config = {"from_attributes": True}

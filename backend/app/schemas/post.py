from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.user import UserPublic


# ── Enquete ───────────────────────────────────────────────────────────
class PollCreate(BaseModel):
    options: list[str]
    multiple: bool = False
    closes_at: datetime


class PollOptionEdit(BaseModel):
    # id presente → opção existente (preserva votos); ausente → nova opção.
    id: Optional[int] = None
    text: str


class PollUpdate(BaseModel):
    options: list[PollOptionEdit]
    multiple: bool
    closes_at: datetime


class PollVoteIn(BaseModel):
    option_ids: list[int]


class PollOptionOut(BaseModel):
    id: int
    text: str
    votes_count: int


class PollOut(BaseModel):
    multiple: bool
    closes_at: datetime
    closed: bool
    total_votes: int
    options: list[PollOptionOut]
    my_votes: list[int]  # ids das opções em que o usuário votou


class PostCreate(BaseModel):
    category: str
    title: Optional[str] = None
    content: str
    image_url: Optional[str] = None
    image: Optional[str] = None  # data URL base64 (ex.: imagem do produto em vendas)
    details: Optional[dict] = None  # campos específicos da categoria
    important: bool = False
    poll: Optional[PollCreate] = None


class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    poll: Optional[PollUpdate] = None


class PostOut(BaseModel):
    id: int
    category: str
    title: Optional[str]
    content: str
    image_url: Optional[str]
    details: Optional[dict] = None
    neighborhood: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    likes_count: int
    comments_count: int
    shares_count: int
    important: bool
    pinned: bool
    created_at: datetime
    author: UserPublic
    liked: bool = False
    poll: Optional[PollOut] = None

    model_config = {"from_attributes": True}


class PostFeed(BaseModel):
    items: list[PostOut]
    total: int
    page: int
    page_size: int

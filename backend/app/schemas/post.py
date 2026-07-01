from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.user import UserPublic


class PostCreate(BaseModel):
    category: str
    title: Optional[str] = None
    content: str
    image_url: Optional[str] = None
    image: Optional[str] = None  # data URL base64 (ex.: imagem do produto em vendas)
    details: Optional[dict] = None  # campos específicos da categoria
    important: bool = False


class PostOut(BaseModel):
    id: int
    category: str
    title: Optional[str]
    content: str
    image_url: Optional[str]
    details: Optional[dict] = None
    neighborhood: str
    likes_count: int
    comments_count: int
    shares_count: int
    important: bool
    pinned: bool
    created_at: datetime
    author: UserPublic
    liked: bool = False

    model_config = {"from_attributes": True}


class PostFeed(BaseModel):
    items: list[PostOut]
    total: int
    page: int
    page_size: int

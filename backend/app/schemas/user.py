from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserPublic(BaseModel):
    id: int
    name: str
    avatar_url: Optional[str]
    neighborhood: str
    badge: Optional[str]
    verified: bool
    posts_count: int
    help_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class UserMe(UserPublic):
    email: EmailStr


class UserUpdate(BaseModel):
    name: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    avatar_url: Optional[str] = None

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator

# Regra única de username (compartilhada com o cadastro).
from app.core.username import USERNAME_RE, validate as _validate_username

__all__ = ["USERNAME_RE"]  # re-exportado para quem importa daqui


class UserPublic(BaseModel):
    id: int
    username: str
    name: str
    bio: Optional[str]
    avatar_url: Optional[str]
    neighborhood: str
    city: Optional[str] = None
    state: Optional[str] = None
    badge: Optional[str]
    verified: bool
    posts_count: int
    help_count: int
    created_at: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # True quando o perfil é de outro bairro: só nome, @username, foto e nº de posts.
    locked: bool = False

    model_config = {"from_attributes": True}


class UserMe(UserPublic):
    email: EmailStr
    # Lido de User.two_factor_enabled (property → totp_enabled).
    two_factor_enabled: bool = False


class UsernameAvailability(BaseModel):
    username: str
    valid: bool
    available: bool


class NeighborhoodStats(BaseModel):
    neighborhood: str
    neighbors: int
    posts: int


class AvatarUpdate(BaseModel):
    image: str  # data URL base64: "data:image/png;base64,...."


class UserUpdate(BaseModel):
    username: Optional[str] = None
    name: Optional[str] = None
    bio: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    avatar_url: Optional[str] = None

    @field_validator("username")
    @classmethod
    def check_username(cls, value: Optional[str]) -> Optional[str]:
        return _validate_username(value) if value is not None else value

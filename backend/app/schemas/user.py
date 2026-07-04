from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

# Regra única de username (compartilhada com o cadastro).
from app.core.username import USERNAME_RE
from app.core.username import validate as _validate_username

__all__ = ["USERNAME_RE"]  # re-exportado para quem importa daqui


class UserPublic(BaseModel):
    id: int
    username: str
    name: str
    bio: str | None
    avatar_url: str | None
    neighborhood: str
    city: str | None = None
    state: str | None = None
    badge: str | None
    verified: bool
    posts_count: int
    interactions_count: int
    created_at: datetime
    latitude: float | None = None
    longitude: float | None = None
    # True quando o perfil é de outro bairro: só nome, @username, foto e nº de posts.
    locked: bool = False

    model_config = {"from_attributes": True}


class UserMe(UserPublic):
    email: EmailStr
    # Lido de User.two_factor_enabled (property → totp_enabled).
    two_factor_enabled: bool = False
    # Aviso de moderação pendente (post/comentário removido) — não persistido no
    # modelo, computado e "consumido" (marcado como lido) a cada /auth/me.
    pending_notice: str | None = None


class UserAdminOut(UserPublic):
    """Visão de usuário para o app de moderação: inclui estado de suspensão."""

    is_suspended: bool
    suspended_until: datetime | None = None
    suspension_reason: str | None = None


class UserSuspendIn(BaseModel):
    # until=None → suspensão por tempo indeterminado.
    until: datetime | None = None
    reason: str = ""


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
    username: str | None = None
    name: str | None = None
    bio: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    avatar_url: str | None = None

    @field_validator("username")
    @classmethod
    def check_username(cls, value: str | None) -> str | None:
        return _validate_username(value) if value is not None else value

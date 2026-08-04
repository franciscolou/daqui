from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

# Regra única de username (compartilhada com o cadastro).
from app.core.username import USERNAME_RE
from app.core.username import validate as _validate_username
from app.models.user import StaffRole, UserBadge

__all__ = ["USERNAME_RE"]  # re-exportado para quem importa daqui


class UserPublic(BaseModel):
    id: int
    username: str
    name: str
    bio: str | None
    avatar_url: str | None
    cover_url: str | None = None
    neighborhood: str
    city: str | None = None
    state: str | None = None
    badge: UserBadge | None
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
    # Privacidade e preferências de notificação (só visíveis para o próprio usuário).
    show_location: bool = True
    searchable: bool = True
    hide_resident_badge: bool = False
    notify_likes: bool = True
    notify_comments: bool = True
    notify_messages: bool = True
    notify_neighborhood_alerts: bool = True
    # "Incluir redondezas": inclui bairros vizinhos no feed e torna o usuário
    # elegível a avisos de post importante desses bairros (ver User.include_nearby).
    include_nearby: bool = False
    # Cargo de staff (app de moderação). None = residente comum.
    staff_role: StaffRole | None = None


class UserAdminOut(UserPublic):
    """Visão de usuário para o app de moderação: inclui estado de suspensão."""

    is_suspended: bool
    suspended_until: datetime | None = None
    suspension_reason: str | None = None


class UserSuspendIn(BaseModel):
    # until=None → suspensão por tempo indeterminado.
    until: datetime | None = None
    reason: str = ""


class UserDeleteIn(BaseModel):
    """Confirmação explícita exigida para a exclusão irreversível pela moderação."""

    username: str


class UsernameAvailability(BaseModel):
    username: str
    valid: bool
    available: bool


class NeighborhoodStats(BaseModel):
    neighborhood: str
    neighbors: int
    posts: int


class CommunityStats(BaseModel):
    """Vitrine pública (sem login) da tela de boas-vindas — ver welcome.tsx."""

    total_users: int
    avatar_urls: list[str]


class AvatarUpdate(BaseModel):
    image: str  # data URL base64: "data:image/png;base64,...."


class CoverUpdate(BaseModel):
    image: str  # data URL base64: "data:image/png;base64,...."


class UserUpdate(BaseModel):
    username: str | None = None
    name: str | None = None
    bio: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    state: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    avatar_url: str | None = None
    show_location: bool | None = None
    searchable: bool | None = None
    hide_resident_badge: bool | None = None
    notify_likes: bool | None = None
    notify_comments: bool | None = None
    notify_messages: bool | None = None
    notify_neighborhood_alerts: bool | None = None
    include_nearby: bool | None = None

    @field_validator("username")
    @classmethod
    def check_username(cls, value: str | None) -> str | None:
        return _validate_username(value) if value is not None else value

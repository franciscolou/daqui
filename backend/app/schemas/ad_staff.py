from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

from app.core.username import validate as _validate_username
from app.models.ad_admin import AdAdminRole


class StaffInviteIn(BaseModel):
    """Convite de conta de staff — só o e-mail (e o cargo, quando quem convida
    é Owner; Administrador só convida Moderador, ver services/staff.py)."""

    email: EmailStr
    role: AdAdminRole = AdAdminRole.MODERADOR


class StaffInviteInfo(BaseModel):
    """O que a tela de aceitar convite mostra antes de pedir usuário/senha."""

    email: EmailStr
    role: AdAdminRole


class StaffAcceptInviteIn(BaseModel):
    token: str
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def check_username(cls, value: str) -> str:
        return _validate_username(value)


class StaffUsernameIn(BaseModel):
    """Renomear conta de staff (só quem está acima no rank — ver services/staff.py)."""

    username: str

    @field_validator("username")
    @classmethod
    def check_username(cls, value: str) -> str:
        return _validate_username(value)


class StaffOut(BaseModel):
    id: int
    email: EmailStr
    username: str
    avatar_url: str | None = None
    role: AdAdminRole
    is_suspended: bool
    created_at: datetime

    model_config = {"from_attributes": True}

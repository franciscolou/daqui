from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

from app.core.username import validate as _validate_username
from app.models.admin import AdAdminRole


class StaffCreateIn(BaseModel):
    email: EmailStr
    username: str
    password: str
    role: AdAdminRole

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

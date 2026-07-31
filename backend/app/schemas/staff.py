from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

from app.core.username import validate as _validate_username
from app.models.user import StaffRole


class StaffCreateIn(BaseModel):
    # Sem campo de nome de exibição: no ambiente de moderação, a única
    # identidade de uma conta de staff é o username (ver StaffOut).
    email: EmailStr
    username: str
    password: str
    role: StaffRole

    @field_validator("username")
    @classmethod
    def check_username(cls, value: str) -> str:
        return _validate_username(value)


class StaffOut(BaseModel):
    id: int
    email: EmailStr
    username: str
    staff_role: StaffRole
    is_suspended: bool
    suspension_reason: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.admin import AdAdminRole


class StaffCreateIn(BaseModel):
    email: EmailStr
    password: str
    role: AdAdminRole


class StaffOut(BaseModel):
    id: int
    email: EmailStr
    role: AdAdminRole
    is_suspended: bool
    created_at: datetime

    model_config = {"from_attributes": True}

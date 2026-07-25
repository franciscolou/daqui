from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.audit_log import AuditLogAction
from app.schemas.user import UserPublic


class AuditLogOut(BaseModel):
    id: int
    action: AuditLogAction
    detail: str
    created_at: datetime
    moderator: UserPublic
    target_user: Optional[UserPublic] = None

    model_config = {"from_attributes": True}

from datetime import datetime

from pydantic import BaseModel

from app.models.ad_audit_log import AdAuditLogAction
from app.schemas.ad_staff import StaffOut


class AdAuditLogOut(BaseModel):
    id: int
    action: AdAuditLogAction
    detail: str
    created_at: datetime
    actor: StaffOut
    target: StaffOut | None = None

    model_config = {"from_attributes": True}

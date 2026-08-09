from datetime import datetime

from pydantic import BaseModel, field_validator

from app.core.config import REPORT_MAX_COMMENT_LENGTH, TICKET_MAX_ATTACHMENTS
from app.models.report import (
    ReportReason,
    ReportStatus,
    ReportTargetType,
)
from app.schemas.attachment import AttachmentItem
from app.schemas.comment import CommentOut
from app.schemas.post import PostOut
from app.schemas.user import UserPublic


class ReportCreate(BaseModel):
    target_type: ReportTargetType
    target_id: int
    reason: ReportReason
    comment: str = ""
    # Já enviados via POST /reports/attachments, até MAX_ATTACHMENTS itens.
    attachments: list[AttachmentItem] = []

    @field_validator("comment")
    @classmethod
    def check_comment(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > REPORT_MAX_COMMENT_LENGTH:
            raise ValueError(
                f"O comentário deve ter no máximo {REPORT_MAX_COMMENT_LENGTH} caracteres"
            )
        return v

    @field_validator("attachments")
    @classmethod
    def check_attachments(cls, v: list[AttachmentItem]) -> list[AttachmentItem]:
        if len(v) > TICKET_MAX_ATTACHMENTS:
            raise ValueError(f"No máximo {TICKET_MAX_ATTACHMENTS} anexos por denúncia")
        return v


class ReportOut(BaseModel):
    id: int
    target_type: ReportTargetType
    reason: ReportReason
    comment: str
    attachments: list[AttachmentItem] = []
    status: ReportStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportAdminOut(ReportOut):
    reporter: UserPublic
    post: PostOut | None = None
    comment_target: CommentOut | None = None
    reported_user: UserPublic | None = None


class ReportStatusUpdate(BaseModel):
    status: ReportStatus


class ReportStats(BaseModel):
    total: int
    pending: int

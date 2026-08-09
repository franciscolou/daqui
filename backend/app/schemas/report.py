from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from app.core.config import MAX_ATTACHMENTS, MAX_COMMENT_LENGTH
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
        if len(v) > MAX_COMMENT_LENGTH:
            raise ValueError(f"O comentário deve ter no máximo {MAX_COMMENT_LENGTH} caracteres")
        return v

    @field_validator("attachments")
    @classmethod
    def check_attachments(cls, v: list[AttachmentItem]) -> list[AttachmentItem]:
        if len(v) > MAX_ATTACHMENTS:
            raise ValueError(f"No máximo {MAX_ATTACHMENTS} anexos por denúncia")
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
    post: Optional[PostOut] = None
    comment_target: Optional[CommentOut] = None
    reported_user: Optional[UserPublic] = None


class ReportStatusUpdate(BaseModel):
    status: ReportStatus


class ReportStats(BaseModel):
    total: int
    pending: int

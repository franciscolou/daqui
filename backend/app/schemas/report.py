from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from app.models.report import MAX_COMMENT_LENGTH, TARGETS
from app.schemas.comment import CommentOut
from app.schemas.post import PostOut
from app.schemas.user import UserPublic


class ReportCreate(BaseModel):
    target_type: str
    target_id: int
    reason: str
    comment: str = ""

    @field_validator("target_type")
    @classmethod
    def check_target_type(cls, v: str) -> str:
        if v not in TARGETS:
            raise ValueError("Tipo de alvo inválido")
        return v

    @field_validator("comment")
    @classmethod
    def check_comment(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > MAX_COMMENT_LENGTH:
            raise ValueError(f"O comentário deve ter no máximo {MAX_COMMENT_LENGTH} caracteres")
        return v


class ReportOut(BaseModel):
    id: int
    target_type: str
    reason: str
    comment: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportAdminOut(ReportOut):
    reporter: UserPublic
    post: Optional[PostOut] = None
    comment_target: Optional[CommentOut] = None
    reported_user: Optional[UserPublic] = None


class ReportStatusUpdate(BaseModel):
    status: str


class ReportStats(BaseModel):
    total: int
    pending: int

from datetime import datetime

from pydantic import BaseModel, field_validator

from app.core.config import (
    TICKET_MAX_ATTACHMENTS,
    TICKET_MAX_MESSAGE_LENGTH,
    TICKET_MAX_RESPONSE_LENGTH,
    TICKET_MAX_SUBJECT_LENGTH,
    REPORT_MAX_COMMENT_LENGTH,
)
from app.models.support_ticket import SupportTicketStatus
from app.schemas.attachment import AttachmentItem
from app.schemas.user import UserPublic


class SupportTicketCreate(BaseModel):
    subject: str
    message: str
    # Já enviados via POST /support-tickets/attachments, até MAX_ATTACHMENTS itens.
    attachments: list[AttachmentItem] = []

    @field_validator("subject")
    @classmethod
    def check_subject(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("O assunto não pode ficar vazio")
        if len(v) > TICKET_MAX_SUBJECT_LENGTH:
            raise ValueError(
                f"O assunto deve ter no máximo {TICKET_MAX_SUBJECT_LENGTH} caracteres"
            )
        return v

    @field_validator("message")
    @classmethod
    def check_message(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("A mensagem não pode ficar vazia")
        if len(v) > TICKET_MAX_MESSAGE_LENGTH:
            raise ValueError(
                f"A mensagem deve ter no máximo {TICKET_MAX_MESSAGE_LENGTH} caracteres"
            )
        return v

    @field_validator("attachments")
    @classmethod
    def check_attachments(cls, v: list[AttachmentItem]) -> list[AttachmentItem]:
        if len(v) > TICKET_MAX_ATTACHMENTS:
            raise ValueError(f"No máximo {TICKET_MAX_ATTACHMENTS} anexos por chamado")
        return v


class SupportTicketOut(BaseModel):
    id: int
    subject: str
    message: str
    attachments: list[AttachmentItem] = []
    status: SupportTicketStatus
    response: str | None = None
    responded_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SupportTicketAdminOut(SupportTicketOut):
    user: UserPublic


class SupportTicketReply(BaseModel):
    response: str

    @field_validator("response")
    @classmethod
    def check_response(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("A resposta não pode ficar vazia")
        if len(v) > TICKET_MAX_RESPONSE_LENGTH:
            raise ValueError(
                f"A resposta deve ter no máximo {TICKET_MAX_RESPONSE_LENGTH} caracteres"
            )
        return v


class SupportTicketStats(BaseModel):
    total: int
    pending: int

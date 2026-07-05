from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from app.models.support_ticket import MAX_MESSAGE_LENGTH, MAX_RESPONSE_LENGTH, MAX_SUBJECT_LENGTH
from app.schemas.user import UserPublic


class SupportTicketCreate(BaseModel):
    subject: str
    message: str

    @field_validator("subject")
    @classmethod
    def check_subject(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("O assunto não pode ficar vazio")
        if len(v) > MAX_SUBJECT_LENGTH:
            raise ValueError(f"O assunto deve ter no máximo {MAX_SUBJECT_LENGTH} caracteres")
        return v

    @field_validator("message")
    @classmethod
    def check_message(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("A mensagem não pode ficar vazia")
        if len(v) > MAX_MESSAGE_LENGTH:
            raise ValueError(f"A mensagem deve ter no máximo {MAX_MESSAGE_LENGTH} caracteres")
        return v


class SupportTicketOut(BaseModel):
    id: int
    subject: str
    message: str
    status: str
    response: Optional[str] = None
    responded_at: Optional[datetime] = None
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
        if len(v) > MAX_RESPONSE_LENGTH:
            raise ValueError(f"A resposta deve ter no máximo {MAX_RESPONSE_LENGTH} caracteres")
        return v


class SupportTicketStats(BaseModel):
    total: int
    pending: int

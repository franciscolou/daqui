from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Estados de um chamado de suporte.
STATUS_PENDING = "pending"
STATUS_ANSWERED = "answered"
STATUSES = {STATUS_PENDING, STATUS_ANSWERED}

MAX_SUBJECT_LENGTH = 120
MAX_MESSAGE_LENGTH = 2000
MAX_RESPONSE_LENGTH = 2000


class SupportTicket(Base):
    """Chamado aberto por um usuário quando Como usar/FAQ não resolveram sua dúvida.

    Fica visível para a moderação (app de moderação) e, depois de respondido,
    a resposta aparece para o próprio usuário em "Meus chamados".
    """

    __tablename__ = "support_tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(MAX_SUBJECT_LENGTH), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default=STATUS_PENDING, index=True)
    response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])  # noqa: F821

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Tipos de ação registrados no log de auditoria da moderação.
ACTION_REVIEW_DELETE = "review_delete"
ACTION_REPORT_RESOLVE = "report_resolve"
ACTION_REPORT_DISMISS = "report_dismiss"
ACTION_REPORT_DELETE = "report_delete"
ACTION_POST_DELETE = "post_delete"
ACTION_COMMENT_DELETE = "comment_delete"
ACTION_USER_SUSPEND = "user_suspend"
ACTION_USER_UNSUSPEND = "user_unsuspend"
ACTION_TICKET_REPLY = "ticket_reply"

ACTIONS = {
    ACTION_REVIEW_DELETE,
    ACTION_REPORT_RESOLVE,
    ACTION_REPORT_DISMISS,
    ACTION_REPORT_DELETE,
    ACTION_POST_DELETE,
    ACTION_COMMENT_DELETE,
    ACTION_USER_SUSPEND,
    ACTION_USER_UNSUSPEND,
    ACTION_TICKET_REPLY,
}


class AuditLog(Base):
    """Registro de auditoria: toda ação da moderação (exclusões, denúncias, suspensões)."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    moderator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    # Usuário afetado pela ação (autor do conteúdo removido, denunciado, suspenso...).
    target_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    moderator: Mapped["User"] = relationship("User", foreign_keys=[moderator_id])  # noqa: F821
    target_user: Mapped[Optional["User"]] = relationship(  # noqa: F821
        "User", foreign_keys=[target_user_id]
    )

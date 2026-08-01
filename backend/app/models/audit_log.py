from datetime import datetime, timezone
from enum import StrEnum
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AuditLogAction(StrEnum):
    """Tipos de ação registrados no log de auditoria da moderação."""

    REVIEW_DELETE = "review_delete"
    REPORT_RESOLVE = "report_resolve"
    REPORT_DISMISS = "report_dismiss"
    REPORT_DELETE = "report_delete"
    POST_DELETE = "post_delete"
    COMMENT_DELETE = "comment_delete"
    USER_SUSPEND = "user_suspend"
    USER_UNSUSPEND = "user_unsuspend"
    TICKET_REPLY = "ticket_reply"
    STAFF_INVITE = "staff_invite"
    STAFF_INVITE_ACCEPTED = "staff_invite_accepted"
    STAFF_USERNAME_CHANGE = "staff_username_change"
    STAFF_SUSPEND = "staff_suspend"
    STAFF_UNSUSPEND = "staff_unsuspend"
    STAFF_DELETE = "staff_delete"


class AuditLog(Base):
    """Registro de auditoria: toda ação da moderação (exclusões, denúncias, suspensões)."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    moderator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    action: Mapped[AuditLogAction] = mapped_column(String(30), nullable=False, index=True)
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

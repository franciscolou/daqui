from datetime import datetime, timezone
from enum import StrEnum
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AdAuditLogAction(StrEnum):
    """Tipos de ação registrados no log de auditoria do painel de anúncios:
    gestão de contas de staff (ver services/staff.py) e movimentações do
    próprio negócio de anúncios (campanhas/planos, ver services/ad.py)."""

    STAFF_INVITE = "staff_invite"
    STAFF_INVITE_ACCEPTED = "staff_invite_accepted"
    STAFF_USERNAME_CHANGE = "staff_username_change"
    STAFF_SUSPEND = "staff_suspend"
    STAFF_UNSUSPEND = "staff_unsuspend"
    STAFF_DELETE = "staff_delete"

    CAMPAIGN_PAUSE = "campaign_pause"
    CAMPAIGN_REACTIVATE = "campaign_reactivate"
    PLAN_CREATE = "plan_create"
    PLAN_UPDATE = "plan_update"
    PLAN_DELETE = "plan_delete"
    PROPOSAL_CREATE = "proposal_create"
    PROPOSAL_CONTENT_SUBMITTED = "proposal_content_submitted"
    PROPOSAL_ACTIVATED = "proposal_activated"


class AdAuditLog(Base):
    """Registro de auditoria do painel de anúncios (espelha AuditLog do backend
    principal, escopado a AdAdmin)."""

    __tablename__ = "ad_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    actor_admin_id: Mapped[int] = mapped_column(ForeignKey("ad_admins.id"), nullable=False, index=True)
    action: Mapped[AdAuditLogAction] = mapped_column(String(30), nullable=False, index=True)
    # Conta de staff afetada pela ação.
    target_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("ad_admins.id"), nullable=True, index=True
    )
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    actor: Mapped["AdAdmin"] = relationship("AdAdmin", foreign_keys=[actor_admin_id])  # noqa: F821
    target: Mapped[Optional["AdAdmin"]] = relationship(  # noqa: F821
        "AdAdmin", foreign_keys=[target_admin_id]
    )

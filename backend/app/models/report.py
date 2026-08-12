from datetime import datetime, timezone
from enum import StrEnum
from typing import Optional

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ReportTargetType(StrEnum):
    """Alvo da denúncia."""

    POST = "post"
    COMMENT = "comment"
    USER = "user"
    AD = "ad"


class ReportReason(StrEnum):
    """Motivos de denúncia — o conjunto válido por alvo está em REASONS_BY_TARGET."""

    OFFENSIVE = "offensive"
    WRONG_CATEGORY = "wrong_category"
    SPAM = "spam"
    HARMFUL = "harmful"
    FAKE_ACCOUNT = "fake"
    NOT_NEIGHBOR = "not_neighbor"
    HARMFUL_PERSON = "harmful_person"


REASONS_BY_TARGET: dict[ReportTargetType, set[ReportReason]] = {
    ReportTargetType.POST: {
        ReportReason.OFFENSIVE, ReportReason.WRONG_CATEGORY, ReportReason.SPAM, ReportReason.HARMFUL,
    },
    ReportTargetType.COMMENT: {ReportReason.OFFENSIVE, ReportReason.SPAM, ReportReason.HARMFUL},
    ReportTargetType.USER: {
        ReportReason.FAKE_ACCOUNT, ReportReason.NOT_NEIGHBOR, ReportReason.HARMFUL_PERSON,
    },
}
# Anúncio é denunciável com os mesmos motivos de um post (mesmo pipeline de
# moderação, só muda o alvo).
REASONS_BY_TARGET[ReportTargetType.AD] = REASONS_BY_TARGET[ReportTargetType.POST]


class ReportStatus(StrEnum):
    """Estados de moderação de uma denúncia."""

    PENDING = "pending"
    REVIEWED = "reviewed"
    DISMISSED = "dismissed"


class Report(Base):
    """Denúncia de post, comentário ou perfil, feita por um usuário do app Daqui."""

    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint(
            # CASE WHEN em vez de somar os IS NOT NULL direto: em Postgres
            # booleano não converte implicitamente pra inteiro (funciona só
            # em SQLite), essa forma roda igual nos dois.
            "(CASE WHEN post_id IS NOT NULL THEN 1 ELSE 0 END)"
            " + (CASE WHEN comment_id IS NOT NULL THEN 1 ELSE 0 END)"
            " + (CASE WHEN reported_user_id IS NOT NULL THEN 1 ELSE 0 END)"
            " + (CASE WHEN ad_campaign_id IS NOT NULL THEN 1 ELSE 0 END) = 1",
            name="report_single_target",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    target_type: Mapped[ReportTargetType] = mapped_column(String(20), nullable=False, index=True)
    post_id: Mapped[Optional[int]] = mapped_column(ForeignKey("posts.id"), nullable=True, index=True)
    comment_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("comments.id"), nullable=True, index=True
    )
    reported_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    ad_campaign_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ad_campaigns.id"), nullable=True, index=True
    )
    reason: Mapped[ReportReason] = mapped_column(String(30), nullable=False)
    comment: Mapped[str] = mapped_column(Text, default="")
    # Até MAX_ATTACHMENTS (ver core/config.py) imagens/vídeos anexados
    # como evidência: [{"url": ..., "type": "image"|"video"}, ...].
    attachments: Mapped[Optional[list[dict]]] = mapped_column(JSON, nullable=True)
    status: Mapped[ReportStatus] = mapped_column(String(20), default=ReportStatus.PENDING, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    reporter: Mapped["User"] = relationship("User", foreign_keys=[reporter_id])  # noqa: F821
    post: Mapped[Optional["Post"]] = relationship("Post", foreign_keys=[post_id])  # noqa: F821
    comment_target: Mapped[Optional["Comment"]] = relationship(  # noqa: F821
        "Comment", foreign_keys=[comment_id]
    )
    reported_user: Mapped[Optional["User"]] = relationship(  # noqa: F821
        "User", foreign_keys=[reported_user_id]
    )
    ad_campaign: Mapped[Optional["AdCampaign"]] = relationship(  # noqa: F821
        "AdCampaign", foreign_keys=[ad_campaign_id]
    )

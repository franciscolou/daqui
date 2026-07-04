from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Alvo da denúncia.
TARGET_POST = "post"
TARGET_COMMENT = "comment"
TARGET_USER = "user"
TARGETS = {TARGET_POST, TARGET_COMMENT, TARGET_USER}

# Motivos por tipo de alvo.
REASON_OFFENSIVE = "ofensivo"
REASON_WRONG_CATEGORY = "categoria_errada"
REASON_SPAM = "spam"
REASON_HARMFUL = "nocivo"
REASON_FAKE_ACCOUNT = "fake"
REASON_HARMFUL_PERSON = "nocivo_pessoa"

REASONS_BY_TARGET: dict[str, set[str]] = {
    TARGET_POST: {REASON_OFFENSIVE, REASON_WRONG_CATEGORY, REASON_SPAM, REASON_HARMFUL},
    TARGET_COMMENT: {REASON_OFFENSIVE, REASON_SPAM, REASON_HARMFUL},
    TARGET_USER: {REASON_FAKE_ACCOUNT, REASON_HARMFUL_PERSON},
}

# Estados de moderação de uma denúncia.
STATUS_PENDING = "pending"
STATUS_REVIEWED = "reviewed"
STATUS_DISMISSED = "dismissed"
STATUSES = {STATUS_PENDING, STATUS_REVIEWED, STATUS_DISMISSED}

MAX_COMMENT_LENGTH = 3000


class Report(Base):
    """Denúncia de post, comentário ou perfil, feita por um usuário do app Daqui."""

    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint(
            "(post_id IS NOT NULL) + (comment_id IS NOT NULL) + (reported_user_id IS NOT NULL) = 1",
            name="report_single_target",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    post_id: Mapped[Optional[int]] = mapped_column(ForeignKey("posts.id"), nullable=True, index=True)
    comment_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("comments.id"), nullable=True, index=True
    )
    reported_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    reason: Mapped[str] = mapped_column(String(30), nullable=False)
    comment: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default=STATUS_PENDING, index=True)
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

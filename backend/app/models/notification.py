from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Avisos de moderação: post/comentário do usuário removido pela moderação.
TYPE_POST_REMOVED = "post_removed"
TYPE_COMMENT_REMOVED = "comment_removed"
MODERATION_NOTICE_TYPES = (TYPE_POST_REMOVED, TYPE_COMMENT_REMOVED)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    # type: like_post | like_comment | comment | follow
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    content: Mapped[str] = mapped_column(String(500), nullable=False)
    # Trecho variável da notificação (texto do post ou do comentário)
    target_text: Mapped[str | None] = mapped_column(String(300), nullable=True)
    post_id: Mapped[int | None] = mapped_column(ForeignKey("posts.id"), nullable=True)
    # Cópia do conteúdo removido (post/comentário já não existe mais no banco) —
    # permite ao usuário ver "o que era" o post/comentário removido pela moderação.
    snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    actor: Mapped[Optional["User"]] = relationship("User", foreign_keys=[actor_id])  # noqa: F821

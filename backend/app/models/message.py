from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    receiver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Post encaminhado dentro da conversa (prévia estilo Twitter). Opcional.
    shared_post_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("posts.id"), nullable=True
    )
    # Mensagem respondida (marcada com duplo clique no app). Opcional.
    reply_to_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("messages.id"), nullable=True
    )
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")  # noqa: F821
    shared_post: Mapped[Optional["Post"]] = relationship("Post", foreign_keys=[shared_post_id])  # noqa: F821
    reply_to: Mapped[Optional["Message"]] = relationship("Message", remote_side=[id])

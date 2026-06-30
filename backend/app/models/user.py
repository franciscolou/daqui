from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    neighborhood: Mapped[str] = mapped_column(String(120), default="")
    city: Mapped[str] = mapped_column(String(120), default="São Paulo")
    badge: Mapped[Optional[str]] = mapped_column(String(30))  # lider | comerciante | morador
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    posts_count: Mapped[int] = mapped_column(Integer, default=0)
    help_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    posts: Mapped[list["Post"]] = relationship("Post", back_populates="author", lazy="select")  # noqa: F821
    sent_messages: Mapped[list["Message"]] = relationship(  # noqa: F821
        "Message", foreign_keys="Message.sender_id", back_populates="sender", lazy="select"
    )

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # username: identificador único (sem espaços); name: nome de exibição livre
    username: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    bio: Mapped[str] = mapped_column(Text, default="")
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    neighborhood: Mapped[str] = mapped_column(String(120), default="")
    city: Mapped[str] = mapped_column(String(120), default="São Paulo")
    badge: Mapped[Optional[str]] = mapped_column(String(30))  # lider | comerciante | morador
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    # A2F (TOTP): segredo base32; totp_enabled só vira True após confirmar um código.
    totp_secret: Mapped[Optional[str]] = mapped_column(String(64))
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    posts_count: Mapped[int] = mapped_column(Integer, default=0)
    help_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    @property
    def two_factor_enabled(self) -> bool:
        """Nome exposto na API para o estado da A2F (ver schema UserMe)."""
        return bool(self.totp_enabled)

    posts: Mapped[list["Post"]] = relationship("Post", back_populates="author", lazy="select")  # noqa: F821
    sent_messages: Mapped[list["Message"]] = relationship(  # noqa: F821
        "Message", foreign_keys="Message.sender_id", back_populates="sender", lazy="select"
    )

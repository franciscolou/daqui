from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
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
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    cover_url: Mapped[str | None] = mapped_column(String(500))
    neighborhood: Mapped[str] = mapped_column(String(120), default="")
    city: Mapped[str] = mapped_column(String(120), default="São Paulo")
    state: Mapped[str] = mapped_column(String(2), default="SP")  # UF
    # Coordenadas capturadas no cadastro (usadas p/ centralizar o mapa do bairro).
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    badge: Mapped[str | None] = mapped_column(String(30))  # lider | comerciante | morador
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    # E-mail confirmado via código de 6 dígitos no cadastro (ver services/auth.py).
    # Não confundir com `verified` acima (selo de perfil confiável).
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_code_hash: Mapped[str | None] = mapped_column(String(255))
    verification_code_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Moderador: acessa o app de moderação (analisa as avaliações do Daqui).
    is_moderator: Mapped[bool] = mapped_column(Boolean, default=False)
    # Suspensão de conta pela moderação: suspended_until=None + is_suspended=True
    # é suspensão por tempo indeterminado; com data, é uma suspensão temporária.
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False)
    suspended_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    suspension_reason: Mapped[str] = mapped_column(Text, default="")
    # A2F (TOTP): segredo base32; totp_enabled só vira True após confirmar um código.
    totp_secret: Mapped[str | None] = mapped_column(String(64))
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    posts_count: Mapped[int] = mapped_column(Integer, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    @property
    def two_factor_enabled(self) -> bool:
        """Nome exposto na API para o estado da A2F (ver schema UserMe)."""
        return bool(self.totp_enabled)

    @property
    def is_currently_suspended(self) -> bool:
        """Suspensão efetiva no momento: leva em conta o fim de suspensões temporárias."""
        if not self.is_suspended:
            return False
        if self.suspended_until is None:
            return True  # indeterminada
        until = self.suspended_until
        if until.tzinfo is None:
            until = until.replace(tzinfo=timezone.utc)
        return until > datetime.now(timezone.utc)

    @property
    def interactions_count(self) -> int:
        """Engajamento do vizinho: posts + comentários feitos."""
        return self.posts_count + self.comments_count

    posts: Mapped[list["Post"]] = relationship("Post", back_populates="author", lazy="select")  # noqa: F821
    sent_messages: Mapped[list["Message"]] = relationship(  # noqa: F821
        "Message", foreign_keys="Message.sender_id", back_populates="sender", lazy="select"
    )

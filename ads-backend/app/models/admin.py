from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AdAdmin(Base):
    """Conta do time interno que gerencia planos/campanhas de anúncio.

    Independente do `User` do backend do Daqui — este serviço não tem acesso
    à base do app principal, então o login do painel de anúncios usa esta
    tabela própria (ver app/core/deps.py::get_current_admin).
    """

    __tablename__ = "ad_admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    # A2F (TOTP): segredo base32; totp_enabled só vira True após confirmar um código.
    totp_secret: Mapped[str | None] = mapped_column(String(64))
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

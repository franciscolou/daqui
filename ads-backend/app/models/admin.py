from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AdAdminRole(StrEnum):
    """Cargos de staff do painel de anúncios. Toda linha de `ad_admins` é staff
    por definição (sem estado "não-staff" — diferente de User.staff_role no
    backend principal)."""

    MODERADOR = "moderador"
    ADMINISTRADOR = "administrador"
    OWNER = "owner"


# Ordem de hierarquia: quem gerencia quem em services/staff.py (Owner > Administrador > Moderador).
AD_ADMIN_RANK = {
    AdAdminRole.MODERADOR: 1,
    AdAdminRole.ADMINISTRADOR: 2,
    AdAdminRole.OWNER: 3,
}


class AdAdmin(Base):
    """Conta do time interno que gerencia planos/campanhas de anúncio.

    Independente do `User` do backend do Daqui — este serviço não tem acesso
    à base do app principal, então o login do painel de anúncios usa esta
    tabela própria (ver app/core/deps.py::get_current_admin). Moderador/
    Administrador/Owner têm paridade operacional total (todos fazem tudo que
    o painel de anúncios oferece) — a única diferença de cargo é o escopo de
    gestão de contas (ver AdAdminRole/AD_ADMIN_RANK acima).
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
    role: Mapped[AdAdminRole] = mapped_column(
        String(20), default=AdAdminRole.MODERADOR, nullable=False
    )
    # Suspensão de conta interna: booleana simples (sem prazo/motivo — diferente
    # da suspensão de usuários finais do Daqui, que é temporizada).
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

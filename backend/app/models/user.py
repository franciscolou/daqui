from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserBadge(StrEnum):
    LEADER = "leader"
    BUSINESS = "business"
    RESIDENT = "resident"


class StaffRole(StrEnum):
    """Cargos de staff (app de moderação). None em `User.staff_role` = residente comum."""

    MODERADOR = "moderador"
    ADMINISTRADOR = "administrador"
    OWNER = "owner"


# Ordem de hierarquia: quem gerencia quem em services/staff.py (Owner > Administrador > Moderador).
STAFF_RANK = {
    StaffRole.MODERADOR: 1,
    StaffRole.ADMINISTRADOR: 2,
    StaffRole.OWNER: 3,
}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # username: identificador único (sem espaços); name: nome de exibição livre
    username: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    # Preenchido só para contas criadas/vinculadas via "Entrar com Google"
    # (sub do token — ver core/google_oauth.py). Conta assim NÃO tem senha de
    # verdade: hashed_password guarda um hash de segredo aleatório inútil,
    # só pra manter a coluna NOT NULL sem espalhar Optional por login/troca
    # de senha (ver services/auth.py::_unusable_password_hash).
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    # False só logo após cadastro via Google (hashed_password é o hash inútil
    # acima) — "Trocar senha" nas Configurações não faz sentido pra essa conta
    # (não existe senha atual pra confirmar). Vira True assim que a pessoa
    # define uma senha de verdade via "Esqueci minha senha" (ver
    # services/auth.py::reset_password), mesmo continuando com google_id
    # setado — por isso não dá pra inferir isso só a partir de google_id.
    has_password: Mapped[bool] = mapped_column(Boolean, default=True)
    bio: Mapped[str] = mapped_column(Text, default="")
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    cover_url: Mapped[str | None] = mapped_column(String(500))
    neighborhood: Mapped[str] = mapped_column(String(120), default="", index=True)
    city: Mapped[str] = mapped_column(String(120), default="São Paulo")
    state: Mapped[str] = mapped_column(String(2), default="SP")  # UF
    # Coordenadas capturadas no cadastro (usadas p/ centralizar o mapa do bairro).
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    badge: Mapped[UserBadge | None] = mapped_column(String(30))
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    # E-mail confirmado via código de 6 dígitos no cadastro (ver services/auth.py).
    # Não confundir com `verified` acima (selo de perfil confiável).
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_code_hash: Mapped[str | None] = mapped_column(String(255))
    verification_code_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Cargo de staff (app de moderação): None = residente comum. Ver StaffRole/STAFF_RANK
    # acima e core/staff_rank.py::can_manage para quem pode gerenciar quem.
    staff_role: Mapped[StaffRole | None] = mapped_column(String(20), nullable=True, default=None)
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
    # Privacidade (tela Configurações > Privacidade e segurança).
    show_location: Mapped[bool] = mapped_column(Boolean, default=True)
    searchable: Mapped[bool] = mapped_column(Boolean, default=True)
    hide_resident_badge: Mapped[bool] = mapped_column(Boolean, default=False)
    # Preferências de notificação (Configurações > Notificações > No aplicativo).
    # Menções e avisos de moderação sempre notificam, independente destas.
    notify_likes: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_comments: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_messages: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_neighborhood_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    # "Incluir redondezas" (toggle do feed, ver LeftSidebar): quando ligado, o
    # usuário também é elegível a receber o aviso de post importante de
    # bairros vizinhos ao seu (ver services/post.py::create_post), além de já
    # controlar se o feed inclui posts das redondezas.
    include_nearby: Mapped[bool] = mapped_column(Boolean, default=False)

    @property
    def two_factor_enabled(self) -> bool:
        """Nome exposto na API para o estado da A2F (ver schema UserMe)."""
        return bool(self.totp_enabled)

    @property
    def is_moderator(self) -> bool:
        """Qualquer cargo de staff (Moderador/Administrador/Owner) — mantido pelo nome
        histórico porque get_current_moderator e vários controllers de moderação já
        dependem dele para o gate "qualquer staff"."""
        return self.staff_role is not None

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

    posts: Mapped[list["Post"]] = relationship(  # noqa: F821
        "Post", back_populates="author", foreign_keys="Post.author_id", lazy="select"
    )
    sent_messages: Mapped[list["Message"]] = relationship(  # noqa: F821
        "Message", foreign_keys="Message.sender_id", back_populates="sender", lazy="select"
    )

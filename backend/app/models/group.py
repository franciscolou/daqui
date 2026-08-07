from datetime import datetime, timezone
from enum import StrEnum
from typing import Optional

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GroupRole(StrEnum):
    """Papéis dentro de um grupo. OWNER é único (o dono); ADMIN pode gerir
    membros; MEMBER é participante comum."""

    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class GroupPrivacy(StrEnum):
    """Privacidade do grupo. PUBLIC: qualquer um entra na hora e o grupo
    aparece no "Descobrir". REQUEST: aparece no "Descobrir", mas entrar exige
    aprovação de um admin/dono (fica pendente em GroupJoinRequest). CLOSED:
    não aparece no "Descobrir", só entra quem for adicionado direto por um
    admin."""

    PUBLIC = "public"
    REQUEST = "request"
    CLOSED = "closed"


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    privacy: Mapped[GroupPrivacy] = mapped_column(String(20), default=GroupPrivacy.CLOSED, nullable=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # Bairro do criador — usado como metadado exibido no Descobrir.
    neighborhood: Mapped[str] = mapped_column(String(120), default="")
    members_count: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    owner: Mapped["User"] = relationship("User", foreign_keys=[owner_id])  # noqa: F821
    members: Mapped[list["GroupMember"]] = relationship(
        "GroupMember", back_populates="group", cascade="all, delete-orphan"
    )


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("group_id", "user_id", name="uq_group_member"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    role: Mapped[GroupRole] = mapped_column(String(20), default=GroupRole.MEMBER, nullable=False)
    # Id da última mensagem lida — base para o contador de não lidas do grupo.
    last_read_message_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    group: Mapped["Group"] = relationship("Group", back_populates="members")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])  # noqa: F821


class GroupJoinRequest(Base):
    """Solicitação de entrada pendente num grupo com privacy="request"."""

    __tablename__ = "group_join_requests"
    __table_args__ = (UniqueConstraint("group_id", "user_id", name="uq_group_join_request"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    group: Mapped["Group"] = relationship("Group")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])  # noqa: F821


class GroupMessage(Base):
    __tablename__ = "group_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False, index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Foto ou vídeo anexado à mensagem (opcional; mensagem pode ser só mídia, sem texto).
    media_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    media_type: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # "image" | "video"
    # Mensagem respondida (marcada com duplo clique no app). Opcional.
    reply_to_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("group_messages.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])  # noqa: F821
    reply_to: Mapped[Optional["GroupMessage"]] = relationship("GroupMessage", remote_side=[id])

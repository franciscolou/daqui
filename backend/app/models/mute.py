from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MuteKind(StrEnum):
    """Silenciamento de notificações por conversa (DM) ou grupo — por usuário,
    não afeta ninguém além de quem silenciou. Mesma dupla usada pra suspensão
    de conta (`User.is_suspended`/`suspended_until`, ver models/user.py): a
    presença da linha é o "está silenciado"; `muted_until=None` é silenciado
    por tempo indeterminado ("até eu reativar"); com data, expira sozinho —
    sem precisar de um job, a leitura já trata data no passado como
    não-silenciado (ver `is_active` abaixo)."""

    DM = "dm"
    GROUP = "group"


class ConversationMute(Base):
    __tablename__ = "conversation_mutes"
    __table_args__ = (
        UniqueConstraint("user_id", "kind", "target_id", name="uq_conversation_mute"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    kind: Mapped[MuteKind] = mapped_column(String(10), nullable=False)
    # "dm": id do outro usuário da conversa. "group": id do grupo.
    target_id: Mapped[int] = mapped_column(Integer, nullable=False)
    muted_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    @property
    def is_active(self) -> bool:
        """Silenciamento efetivo agora — leva em conta o fim de silenciamentos temporários."""
        if self.muted_until is None:
            return True  # indeterminado
        until = self.muted_until
        if until.tzinfo is None:
            until = until.replace(tzinfo=timezone.utc)
        return until > datetime.now(timezone.utc)

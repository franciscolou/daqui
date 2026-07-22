from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PushToken(Base):
    """Token de push (Expo Push Service) de um dispositivo do usuário.

    Um usuário pode ter vários tokens (vários dispositivos). O token em si é
    único: se o mesmo dispositivo logar com outra conta, o upsert (ver
    `daos/push_token.py`) reatribui a linha pro novo dono em vez de duplicar.
    """

    __tablename__ = "push_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    platform: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

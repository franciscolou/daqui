from datetime import datetime, timezone
from enum import StrEnum
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AnalyticsEventType(StrEnum):
    """Tipos de evento de telemetria do app principal (ver services/analytics.py)."""

    SCREEN_VIEW = "screen_view"
    CLICK = "click"
    SEARCH = "search"


class AnalyticsEvent(Base):
    """Evento de uso do app principal, reportado em lote pelo cliente
    (ver lib/analytics.ts do frontend). Cobre telas visitadas/tempo de
    permanência, cliques em ações-chave e buscas — a aba Analytics do
    moderator (Owner-only) agrega esta tabela, ver services/analytics.py."""

    __tablename__ = "analytics_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    # Gerado no cliente por abertura do app, não persistido entre sessões —
    # correlaciona os eventos de uma mesma "sessão" sem precisar de tabela própria.
    session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    event_type: Mapped[AnalyticsEventType] = mapped_column(String(20), nullable=False, index=True)
    # Chave de rota normalizada (ex.: "(tabs)/index", "post/[id]") — ver
    # lib/analytics.ts::normalizeScreen no frontend.
    screen: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    # Nome da ação, só para event_type == click (ex.: "like_post", "tab_search").
    label: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    # Texto pesquisado, só para event_type == search.
    query: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # Tempo passado em `screen`, só para event_type == screen_view.
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # screen_view encerrada por app indo pra background/fechando, não por
    # navegação normal — usado pra "telas em que mais fecham o app".
    is_exit: Mapped[bool] = mapped_column(Boolean, default=False)
    platform: Mapped[str] = mapped_column(String(10), default="web")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

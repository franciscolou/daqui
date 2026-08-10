from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.analytics import AnalyticsEvent, AnalyticsEventType


def bulk_create(db: Session, user_id: int, events: list[dict]) -> None:
    db.add_all(AnalyticsEvent(user_id=user_id, **event) for event in events)
    db.commit()


def _in_range(query, start: datetime, end: datetime, platform: str | None = None):
    query = query.filter(AnalyticsEvent.created_at >= start, AnalyticsEvent.created_at < end)
    if platform:
        query = query.filter(AnalyticsEvent.platform == platform)
    return query


def active_users_count(db: Session, start: datetime, end: datetime, platform: str | None = None) -> int:
    return _in_range(
        db.query(func.count(func.distinct(AnalyticsEvent.user_id))), start, end, platform
    ).scalar() or 0


def count_by_type(
    db: Session, start: datetime, end: datetime, event_type: AnalyticsEventType, platform: str | None = None
) -> int:
    return _in_range(
        db.query(func.count(AnalyticsEvent.id)).filter(AnalyticsEvent.event_type == event_type),
        start,
        end,
        platform,
    ).scalar() or 0


def daily_active_users(
    db: Session, start: datetime, end: datetime, platform: str | None = None
) -> list[tuple[str, int]]:
    day = func.date(AnalyticsEvent.created_at)
    q = _in_range(
        db.query(day.label("day"), func.count(func.distinct(AnalyticsEvent.user_id))),
        start,
        end,
        platform,
    )
    return q.group_by(day).order_by(day).all()


def session_stats(
    db: Session, start: datetime, end: datetime, platform: str | None = None
) -> tuple[int, float]:
    """Total de sessões distintas e duração média por sessão (soma de
    duration_ms das screen_view de cada sessão, depois média entre sessões)."""
    total_sessions = _in_range(
        db.query(func.count(func.distinct(AnalyticsEvent.session_id))), start, end, platform
    ).scalar() or 0

    per_session = (
        _in_range(
            db.query(AnalyticsEvent.session_id, func.sum(AnalyticsEvent.duration_ms)),
            start,
            end,
            platform,
        )
        .filter(AnalyticsEvent.event_type == AnalyticsEventType.SCREEN_VIEW)
        .filter(AnalyticsEvent.duration_ms.isnot(None))
        .group_by(AnalyticsEvent.session_id)
        .all()
    )
    durations = [total or 0 for _sid, total in per_session]
    avg_duration_ms = sum(durations) / len(durations) if durations else 0.0
    return total_sessions, avg_duration_ms


def screen_views_per_session(
    db: Session, start: datetime, end: datetime, platform: str | None = None
) -> float:
    total_sessions = _in_range(
        db.query(func.count(func.distinct(AnalyticsEvent.session_id))), start, end, platform
    ).scalar() or 0
    if not total_sessions:
        return 0.0
    total_views = _in_range(
        db.query(func.count(AnalyticsEvent.id)).filter(
            AnalyticsEvent.event_type == AnalyticsEventType.SCREEN_VIEW
        ),
        start,
        end,
        platform,
    ).scalar() or 0
    return total_views / total_sessions


def screen_time_totals(
    db: Session, start: datetime, end: datetime, limit: int, platform: str | None = None
) -> list[tuple[str, int, int]]:
    """(screen, avg_duration_ms, views) das telas com mais tempo total, desc."""
    q = (
        _in_range(
            db.query(
                AnalyticsEvent.screen,
                func.avg(AnalyticsEvent.duration_ms),
                func.count(AnalyticsEvent.id),
            ),
            start,
            end,
            platform,
        )
        .filter(AnalyticsEvent.event_type == AnalyticsEventType.SCREEN_VIEW)
        .filter(AnalyticsEvent.duration_ms.isnot(None))
        .filter(AnalyticsEvent.screen.isnot(None))
        .group_by(AnalyticsEvent.screen)
        .order_by(func.sum(AnalyticsEvent.duration_ms).desc())
        .limit(limit)
    )
    return q.all()


def exit_screen_counts(
    db: Session, start: datetime, end: datetime, limit: int, platform: str | None = None
) -> list[tuple[str, int]]:
    q = (
        _in_range(
            db.query(AnalyticsEvent.screen, func.count(AnalyticsEvent.id)),
            start,
            end,
            platform,
        )
        .filter(AnalyticsEvent.event_type == AnalyticsEventType.SCREEN_VIEW)
        .filter(AnalyticsEvent.is_exit.is_(True))
        .filter(AnalyticsEvent.screen.isnot(None))
        .group_by(AnalyticsEvent.screen)
        .order_by(func.count(AnalyticsEvent.id).desc())
        .limit(limit)
    )
    return q.all()


def click_counts(
    db: Session, start: datetime, end: datetime, limit: int, platform: str | None = None
) -> list[tuple[str, str, int]]:
    q = (
        _in_range(
            db.query(
                AnalyticsEvent.label,
                AnalyticsEvent.screen,
                func.count(AnalyticsEvent.id),
            ),
            start,
            end,
            platform,
        )
        .filter(AnalyticsEvent.event_type == AnalyticsEventType.CLICK)
        .group_by(AnalyticsEvent.label, AnalyticsEvent.screen)
        .order_by(func.count(AnalyticsEvent.id).desc())
        .limit(limit)
    )
    return q.all()


def top_searches(
    db: Session, start: datetime, end: datetime, limit: int, platform: str | None = None
) -> list[tuple[str, int]]:
    q = (
        _in_range(
            db.query(AnalyticsEvent.query, func.count(AnalyticsEvent.id)),
            start,
            end,
            platform,
        )
        .filter(AnalyticsEvent.event_type == AnalyticsEventType.SEARCH)
        .filter(AnalyticsEvent.query.isnot(None))
        .filter(AnalyticsEvent.query != "")
        .group_by(AnalyticsEvent.query)
        .order_by(func.count(AnalyticsEvent.id).desc())
        .limit(limit)
    )
    return q.all()


def platform_breakdown(db: Session, start: datetime, end: datetime) -> list[tuple[str, int]]:
    """Usuários ativos distintos por plataforma — não recebe `platform` (é a
    própria dimensão sendo quebrada), diferente das funções acima."""
    q = _in_range(
        db.query(AnalyticsEvent.platform, func.count(func.distinct(AnalyticsEvent.user_id))),
        start,
        end,
    ).group_by(AnalyticsEvent.platform)
    return q.all()


def hourly_activity(
    db: Session, start: datetime, end: datetime, platform: str | None = None
) -> list[tuple[str, int]]:
    """(hora "00"-"23", total de eventos) — hora local do servidor, mesma
    convenção simples de `daily_active_users` (sem fuso por usuário)."""
    hour = func.strftime("%H", AnalyticsEvent.created_at)
    q = _in_range(db.query(hour.label("hour"), func.count(AnalyticsEvent.id)), start, end, platform)
    return q.group_by(hour).order_by(hour).all()


def new_vs_returning(
    db: Session, start: datetime, end: datetime, platform: str | None = None
) -> tuple[int, int]:
    """Entre os usuários ativos no período, quantos tiveram o primeiro evento
    de sempre (sem limite de período) dentro dele (novos) vs antes (recorrentes)."""
    active_ids_q = _in_range(db.query(AnalyticsEvent.user_id.distinct()), start, end, platform)
    active_ids = [row[0] for row in active_ids_q.all()]
    if not active_ids:
        return 0, 0
    first_seen_rows = (
        db.query(AnalyticsEvent.user_id, func.min(AnalyticsEvent.created_at))
        .filter(AnalyticsEvent.user_id.in_(active_ids))
        .group_by(AnalyticsEvent.user_id)
        .all()
    )
    def _aware(dt: datetime) -> datetime:
        return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)

    new_count = sum(1 for _uid, first_seen in first_seen_rows if _aware(first_seen) >= start)
    return new_count, len(first_seen_rows) - new_count

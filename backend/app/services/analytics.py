from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import (
    ANALYTICS_DEFAULT_RANGE_DAYS,
    ANALYTICS_MAX_EVENTS_PER_BATCH,
    ANALYTICS_MAX_LABEL_LENGTH,
    ANALYTICS_MAX_QUERY_LENGTH,
    ANALYTICS_MAX_TOP_N,
    ANALYTICS_TOP_N,
)
from app.daos import analytics as analytics_dao
from app.models.analytics import AnalyticsEventType
from app.schemas.analytics import (
    AnalyticsEventIn,
    AnalyticsOverviewOut,
    ClickStatOut,
    DailyActiveUsersOut,
    HourlyStatOut,
    PlatformStatOut,
    ScreenExitOut,
    ScreenTimeOut,
    SearchStatOut,
)


def ingest_events(db: Session, user_id: int, events: list[AnalyticsEventIn]) -> None:
    """Best-effort por natureza: chamado de um endpoint dedicado só de
    telemetria (não em cima de outro fluxo), então erros aqui já não afetam
    nada além da própria ingestão — o lado que precisa ser à prova de falha
    é o cliente (ver lib/analytics.ts, fire-and-forget)."""
    rows = []
    for event in events[:ANALYTICS_MAX_EVENTS_PER_BATCH]:
        query = event.query
        if event.event_type == AnalyticsEventType.SEARCH and query:
            query = query.strip().lower()[:ANALYTICS_MAX_QUERY_LENGTH]
        rows.append(
            {
                "session_id": event.session_id,
                "event_type": event.event_type,
                "screen": event.screen,
                "label": event.label[:ANALYTICS_MAX_LABEL_LENGTH] if event.label else None,
                "query": query,
                "duration_ms": event.duration_ms,
                "is_exit": event.is_exit,
                "platform": event.platform,
            }
        )
    if rows:
        analytics_dao.bulk_create(db, user_id, rows)


def _resolve_range(date_from: date | None, date_to: date | None) -> tuple[date, date, datetime, datetime]:
    resolved_to = date_to or datetime.now(timezone.utc).date()
    resolved_from = date_from or (resolved_to - timedelta(days=ANALYTICS_DEFAULT_RANGE_DAYS - 1))
    start = datetime.combine(resolved_from, time.min, tzinfo=timezone.utc)
    end = datetime.combine(resolved_to + timedelta(days=1), time.min, tzinfo=timezone.utc)
    return resolved_from, resolved_to, start, end


def get_overview(
    db: Session,
    date_from: date | None,
    date_to: date | None,
    platform: str | None = None,
    limit: int | None = None,
) -> AnalyticsOverviewOut:
    resolved_from, resolved_to, start, end = _resolve_range(date_from, date_to)
    top_n = min(limit, ANALYTICS_MAX_TOP_N) if limit else ANALYTICS_TOP_N

    active_users = analytics_dao.active_users_count(db, start, end, platform)
    total_sessions, avg_session_duration_ms = analytics_dao.session_stats(db, start, end, platform)
    total_searches = analytics_dao.count_by_type(db, start, end, AnalyticsEventType.SEARCH, platform)
    total_clicks = analytics_dao.count_by_type(db, start, end, AnalyticsEventType.CLICK, platform)
    avg_screens_per_session = analytics_dao.screen_views_per_session(db, start, end, platform)
    new_users, returning_users = analytics_dao.new_vs_returning(db, start, end, platform)

    daily = analytics_dao.daily_active_users(db, start, end, platform)
    screens = analytics_dao.screen_time_totals(db, start, end, top_n, platform)
    exits = analytics_dao.exit_screen_counts(db, start, end, top_n, platform)
    clicks = analytics_dao.click_counts(db, start, end, top_n, platform)
    searches = analytics_dao.top_searches(db, start, end, top_n, platform)
    platforms = analytics_dao.platform_breakdown(db, start, end)
    hourly = analytics_dao.hourly_activity(db, start, end, platform)

    return AnalyticsOverviewOut(
        date_from=resolved_from,
        date_to=resolved_to,
        active_users=active_users,
        total_sessions=total_sessions,
        avg_session_duration_seconds=avg_session_duration_ms / 1000,
        total_searches=total_searches,
        total_clicks=total_clicks,
        new_users=new_users,
        returning_users=returning_users,
        avg_screens_per_session=avg_screens_per_session,
        daily_active_users=[DailyActiveUsersOut(date=day, count=count) for day, count in daily],
        top_screens=[
            ScreenTimeOut(screen=screen, avg_duration_seconds=(avg_ms or 0) / 1000, views=views)
            for screen, avg_ms, views in screens
        ],
        top_exit_screens=[ScreenExitOut(screen=screen, exits=exits_count) for screen, exits_count in exits],
        top_clicks=[
            ClickStatOut(label=label, screen=screen, count=count) for label, screen, count in clicks
        ],
        top_searches=[SearchStatOut(query=query, count=count) for query, count in searches],
        platform_breakdown=[
            PlatformStatOut(platform=platform_name, active_users=count) for platform_name, count in platforms
        ],
        hourly_activity=[HourlyStatOut(hour=hour, count=count) for hour, count in hourly],
    )

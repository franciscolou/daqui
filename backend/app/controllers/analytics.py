from datetime import date

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_owner, get_current_user, get_db
from app.models.user import User
from app.schemas.analytics import AnalyticsEventsIn, AnalyticsOverviewOut
from app.services import analytics as analytics_service


# ── App Daqui (usuário autenticado) ───────────────────────────────────
def ingest_events(
    payload: AnalyticsEventsIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    analytics_service.ingest_events(db, user.id, payload.events)


# ── App de moderação (restrito ao Owner) ──────────────────────────────
def get_overview(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    platform: str | None = Query(None),
    limit: int | None = Query(None, ge=1),
    db: Session = Depends(get_db),
    _owner: User = Depends(get_current_owner),
) -> AnalyticsOverviewOut:
    return analytics_service.get_overview(db, date_from, date_to, platform, limit)

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_moderator, get_current_user, get_db
from app.models.user import User
from app.schemas.report import (
    ReportAdminOut,
    ReportCreate,
    ReportOut,
    ReportStats,
    ReportStatusUpdate,
)
from app.services import report as report_service


# ── Usuário (app Daqui) ───────────────────────────────────────────────
def submit_report(
    payload: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportOut:
    return report_service.submit(db, current_user, payload)


# ── Moderador (app de moderação) ──────────────────────────────────────
def list_reports(
    status: str | None = Query(None, description="Filtra por status"),
    target_type: str | None = Query(None, description="Filtra por tipo de alvo"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> list[ReportAdminOut]:
    return report_service.admin_list(db, status, target_type, page, page_size)


def reports_stats(
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> ReportStats:
    return report_service.admin_stats(db)


def set_report_status(
    report_id: int,
    payload: ReportStatusUpdate,
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> ReportAdminOut:
    return report_service.admin_set_status(db, report_id, payload.status, _mod)


def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> None:
    report_service.admin_delete(db, report_id, _mod)

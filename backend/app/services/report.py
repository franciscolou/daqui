from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.daos import comment as comment_dao
from app.daos import post as post_dao
from app.daos import report as report_dao
from app.daos import user as user_dao
from app.models.report import REASONS_BY_TARGET, STATUSES, TARGET_COMMENT, TARGET_POST, Report
from app.models.user import User
from app.schemas.comment import CommentOut
from app.schemas.post import PostOut
from app.schemas.report import ReportAdminOut, ReportCreate, ReportOut, ReportStats
from app.schemas.user import UserPublic


def submit(db: Session, user: User, payload: ReportCreate) -> ReportOut:
    reasons = REASONS_BY_TARGET.get(payload.target_type)
    if reasons is None or payload.reason not in reasons:
        raise HTTPException(status_code=400, detail="Motivo inválido para este tipo de denúncia")

    if payload.target_type == TARGET_POST:
        target = post_dao.get_by_id(db, payload.target_id)
    elif payload.target_type == TARGET_COMMENT:
        target = comment_dao.get_by_id(db, payload.target_id)
    else:
        target = user_dao.get_by_id(db, payload.target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Conteúdo denunciado não encontrado")

    report = report_dao.create(
        db, user.id, payload.target_type, payload.target_id, payload.reason, payload.comment
    )
    return ReportOut.model_validate(report)


# ── Moderação ─────────────────────────────────────────────────────────
def _admin_out(report: Report) -> ReportAdminOut:
    out = ReportAdminOut.model_validate(report)
    out.reporter = UserPublic.model_validate(report.reporter)
    out.post = PostOut.model_validate(report.post) if report.post else None
    out.comment_target = CommentOut.model_validate(report.comment_target) if report.comment_target else None
    out.reported_user = UserPublic.model_validate(report.reported_user) if report.reported_user else None
    return out


def admin_list(
    db: Session, status: str | None, target_type: str | None, page: int, page_size: int
) -> list[ReportAdminOut]:
    if status and status not in STATUSES:
        raise HTTPException(status_code=400, detail="Status inválido")
    offset = (page - 1) * page_size
    reports = report_dao.list_all(db, status, target_type, offset, page_size)
    return [_admin_out(r) for r in reports]


def admin_stats(db: Session) -> ReportStats:
    return ReportStats(
        total=report_dao.count(db, None, None),
        pending=report_dao.count(db, "pending", None),
    )


def admin_set_status(db: Session, report_id: int, status: str) -> ReportAdminOut:
    if status not in STATUSES:
        raise HTTPException(status_code=400, detail="Status inválido")
    report = report_dao.get_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Denúncia não encontrada")
    report = report_dao.set_status(db, report, status)
    return _admin_out(report)


def admin_delete(db: Session, report_id: int) -> None:
    report = report_dao.get_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Denúncia não encontrada")
    report_dao.delete(db, report)

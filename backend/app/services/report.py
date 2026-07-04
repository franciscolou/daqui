from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.daos import comment as comment_dao
from app.daos import post as post_dao
from app.daos import report as report_dao
from app.daos import user as user_dao
from app.models.audit_log import (
    ACTION_REPORT_DELETE,
    ACTION_REPORT_DISMISS,
    ACTION_REPORT_RESOLVE,
)
from app.models.report import (
    REASONS_BY_TARGET,
    STATUS_DISMISSED,
    STATUS_REVIEWED,
    STATUSES,
    TARGET_COMMENT,
    TARGET_POST,
    TARGET_USER,
    Report,
)
from app.models.user import User
from app.schemas.comment import CommentOut
from app.schemas.post import PostOut
from app.schemas.report import ReportAdminOut, ReportCreate, ReportOut, ReportStats
from app.schemas.user import UserPublic
from app.services import audit_log as audit_log_service


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


def _affected_user_id(report: Report) -> int | None:
    """Usuário afetado pela denúncia: o autor do conteúdo (ou o perfil denunciado)."""
    if report.target_type == TARGET_POST:
        return report.post.author_id if report.post else None
    if report.target_type == TARGET_COMMENT:
        return report.comment_target.author_id if report.comment_target else None
    if report.target_type == TARGET_USER:
        return report.reported_user_id
    return None


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


def admin_set_status(db: Session, report_id: int, status: str, moderator: User) -> ReportAdminOut:
    if status not in STATUSES:
        raise HTTPException(status_code=400, detail="Status inválido")
    report = report_dao.get_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Denúncia não encontrada")
    affected = _affected_user_id(report)
    detail = f"Denúncia #{report.id} ({report.reason})"
    report = report_dao.set_status(db, report, status)
    if status == STATUS_REVIEWED:
        audit_log_service.log(db, moderator, ACTION_REPORT_RESOLVE, affected, detail)
    elif status == STATUS_DISMISSED:
        audit_log_service.log(db, moderator, ACTION_REPORT_DISMISS, affected, detail)
    return _admin_out(report)


def admin_delete(db: Session, report_id: int, moderator: User) -> None:
    report = report_dao.get_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Denúncia não encontrada")
    affected = _affected_user_id(report)
    detail = f"Denúncia #{report.id} ({report.reason})"
    report_dao.delete(db, report)
    audit_log_service.log(db, moderator, ACTION_REPORT_DELETE, affected, detail)

from sqlalchemy.orm import Session

from app.daos import audit_log as audit_log_dao
from app.models.admin import AdAdmin
from app.models.audit_log import AdAuditLog, AdAuditLogAction
from app.schemas.audit_log import AdAuditLogOut
from app.schemas.staff import StaffOut


def log(
    db: Session,
    actor: AdAdmin,
    action: AdAuditLogAction,
    target_admin_id: int | None = None,
    detail: str = "",
) -> None:
    audit_log_dao.create(db, actor.id, action, target_admin_id, detail)


def _out(entry: AdAuditLog) -> AdAuditLogOut:
    out = AdAuditLogOut.model_validate(entry)
    out.actor = StaffOut.model_validate(entry.actor)
    out.target = StaffOut.model_validate(entry.target) if entry.target else None
    return out


def admin_list(db: Session, page: int, page_size: int) -> list[AdAuditLogOut]:
    offset = (page - 1) * page_size
    entries = audit_log_dao.list_all(db, offset, page_size)
    return [_out(e) for e in entries]

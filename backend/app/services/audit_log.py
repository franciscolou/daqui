from sqlalchemy.orm import Session

from app.daos import audit_log as audit_log_dao
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit_log import AuditLogOut
from app.schemas.user import UserPublic


def log(
    db: Session,
    moderator: User,
    action: str,
    target_user_id: int | None = None,
    detail: str = "",
) -> None:
    audit_log_dao.create(db, moderator.id, action, target_user_id, detail)


def _out(entry: AuditLog) -> AuditLogOut:
    out = AuditLogOut.model_validate(entry)
    out.moderator = UserPublic.model_validate(entry.moderator)
    out.target_user = UserPublic.model_validate(entry.target_user) if entry.target_user else None
    return out


def admin_list(
    db: Session,
    moderator: str | None,
    target_user: str | None,
    action: str | None,
    page: int,
    page_size: int,
) -> list[AuditLogOut]:
    offset = (page - 1) * page_size
    entries = audit_log_dao.list_all(db, moderator, target_user, action, offset, page_size)
    return [_out(e) for e in entries]

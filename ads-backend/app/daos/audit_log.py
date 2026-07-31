from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.audit_log import AdAuditLog, AdAuditLogAction


def create(
    db: Session,
    actor_admin_id: int,
    action: AdAuditLogAction,
    target_admin_id: int | None,
    detail: str,
) -> AdAuditLog:
    entry = AdAuditLog(
        actor_admin_id=actor_admin_id,
        action=action,
        target_admin_id=target_admin_id,
        detail=detail,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def list_all(db: Session, offset: int, limit: int) -> list[AdAuditLog]:
    return db.query(AdAuditLog).order_by(desc(AdAuditLog.created_at)).offset(offset).limit(limit).all()

from sqlalchemy import desc, or_
from sqlalchemy.orm import Session, aliased

from app.models.admin import AdAdmin
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


def list_all(
    db: Session,
    actor: str | None,
    action: AdAuditLogAction | None,
    offset: int,
    limit: int,
) -> list[AdAuditLog]:
    q = db.query(AdAuditLog)
    if actor:
        Actor = aliased(AdAdmin)
        like = f"%{actor}%"
        q = q.join(Actor, AdAuditLog.actor_admin_id == Actor.id).filter(
            or_(Actor.username.ilike(like), Actor.email.ilike(like))
        )
    if action:
        q = q.filter(AdAuditLog.action == action)
    return q.order_by(desc(AdAuditLog.created_at)).offset(offset).limit(limit).all()

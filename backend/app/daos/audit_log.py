from sqlalchemy import desc, or_
from sqlalchemy.orm import Session, aliased

from app.models.audit_log import AuditLog
from app.models.user import User


def create(
    db: Session,
    moderator_id: int,
    action: str,
    target_user_id: int | None,
    detail: str,
) -> AuditLog:
    entry = AuditLog(
        moderator_id=moderator_id,
        action=action,
        target_user_id=target_user_id,
        detail=detail,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def list_all(
    db: Session,
    moderator: str | None,
    target_user: str | None,
    action: str | None,
    offset: int,
    limit: int,
) -> list[AuditLog]:
    q = db.query(AuditLog)
    if moderator:
        Moderator = aliased(User)
        like = f"%{moderator}%"
        q = q.join(Moderator, AuditLog.moderator_id == Moderator.id).filter(
            or_(Moderator.name.ilike(like), Moderator.username.ilike(like))
        )
    if target_user:
        Target = aliased(User)
        like = f"%{target_user}%"
        q = q.join(Target, AuditLog.target_user_id == Target.id).filter(
            or_(Target.name.ilike(like), Target.username.ilike(like))
        )
    if action:
        q = q.filter(AuditLog.action == action)
    return q.order_by(desc(AuditLog.created_at)).offset(offset).limit(limit).all()

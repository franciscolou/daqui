from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.session import UserSession


def create(
    db: Session,
    *,
    user_id: int,
    jti: str,
    device_name: str,
    user_agent: str,
    ip_address: str | None,
) -> UserSession:
    session = UserSession(
        user_id=user_id,
        jti=jti,
        device_name=device_name,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_by_jti(db: Session, jti: str) -> UserSession | None:
    return db.query(UserSession).filter(UserSession.jti == jti).first()


def get_by_id(db: Session, session_id: int) -> UserSession | None:
    return db.get(UserSession, session_id)


def list_active_for_user(db: Session, user_id: int) -> list[UserSession]:
    return (
        db.query(UserSession)
        .filter(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .order_by(UserSession.created_at.desc())
        .all()
    )


def revoke(db: Session, session: UserSession) -> None:
    session.revoked_at = datetime.now(timezone.utc)
    db.commit()

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
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
    # "Ativa" também exige o token ainda não ter expirado — sem isso, sessões
    # de logins antigos (nunca desconectadas manualmente nem revogadas por
    # logout, ver auth.logout) ficam listadas para sempre em "Dispositivos
    # conectados" mesmo depois que o JWT em si já parou de funcionar.
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return (
        db.query(UserSession)
        .filter(
            UserSession.user_id == user_id,
            UserSession.revoked_at.is_(None),
            UserSession.created_at >= cutoff,
        )
        .order_by(UserSession.created_at.desc())
        .all()
    )


def revoke(db: Session, session: UserSession) -> None:
    session.revoked_at = datetime.now(timezone.utc)
    db.commit()


def revoke_all_for_user(db: Session, user_id: int) -> None:
    """Encerra todas as sessões ativas — usado após redefinição de senha."""
    now = datetime.now(timezone.utc)
    db.query(UserSession).filter(
        UserSession.user_id == user_id, UserSession.revoked_at.is_(None)
    ).update({"revoked_at": now})
    db.commit()

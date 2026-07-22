from sqlalchemy.orm import Session

from app.models.push_token import PushToken


def upsert(db: Session, user_id: int, token: str, platform: str) -> PushToken:
    row = db.query(PushToken).filter(PushToken.token == token).first()
    if row:
        row.user_id = user_id
        row.platform = platform
    else:
        row = PushToken(user_id=user_id, token=token, platform=platform)
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


def remove(db: Session, token: str) -> None:
    db.query(PushToken).filter(PushToken.token == token).delete()
    db.commit()


def list_tokens_for_user(db: Session, user_id: int) -> list[str]:
    rows = db.query(PushToken).filter(PushToken.user_id == user_id).all()
    return [r.token for r in rows]

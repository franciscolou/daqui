from sqlalchemy.orm import Session

from app.core.push import send_push
from app.daos import push_token as push_token_dao
from app.models.user import User


def register(db: Session, user: User, token: str, platform: str) -> None:
    push_token_dao.upsert(db, user.id, token, platform)


def unregister(db: Session, token: str) -> None:
    push_token_dao.remove(db, token)


def notify_user(db: Session, user_id: int, title: str, body: str, data: dict | None = None) -> None:
    tokens = push_token_dao.list_tokens_for_user(db, user_id)
    send_push(tokens, title, body, data)

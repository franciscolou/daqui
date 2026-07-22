from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.push import PushTokenIn
from app.services import push as push_service


def register_push_token(
    payload: PushTokenIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    push_service.register(db, current_user, payload.token, payload.platform)


def unregister_push_token(
    token: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    push_service.unregister(db, token)

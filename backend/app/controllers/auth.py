from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse
from app.schemas.user import UserMe
from app.services import auth


def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return auth.signup(db, payload)


def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return auth.login(db, payload)


def me(current_user: User = Depends(get_current_user)) -> UserMe:
    return current_user

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    SignupRequest,
    TokenResponse,
    TwoFactorCodeRequest,
    TwoFactorLoginRequest,
    TwoFactorSetupResponse,
)
from app.schemas.user import UserMe
from app.services import auth


def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return auth.signup(db, payload)


def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    return auth.login(db, payload)


def login_2fa(payload: TwoFactorLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return auth.login_2fa(db, payload)


def me(current_user: User = Depends(get_current_user)) -> UserMe:
    return current_user


def two_factor_setup(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TwoFactorSetupResponse:
    return auth.start_2fa_setup(db, current_user)


def two_factor_enable(
    payload: TwoFactorCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserMe:
    auth.enable_2fa(db, current_user, payload.code)
    return current_user


def two_factor_disable(
    payload: TwoFactorCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserMe:
    auth.disable_2fa(db, current_user, payload.code)
    return current_user

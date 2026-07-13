from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    AvailabilityResponse,
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    SignupRequest,
    TokenResponse,
    TwoFactorCodeRequest,
    TwoFactorLoginRequest,
    TwoFactorSetupResponse,
)
from app.schemas.session import SessionOut
from app.schemas.user import UserMe
from app.services import auth


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def signup(payload: SignupRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    return auth.signup(db, payload, request.headers.get("user-agent", ""), _client_ip(request))


def check_username(username: str, db: Session = Depends(get_db)) -> AvailabilityResponse:
    # Público: checagem em tempo real no cadastro.
    return auth.check_username(db, username)


def check_email(email: str, db: Session = Depends(get_db)) -> AvailabilityResponse:
    # Público: checagem em tempo real no cadastro.
    return auth.check_email(db, email)


def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> LoginResponse:
    return auth.login(db, payload, request.headers.get("user-agent", ""), _client_ip(request))


def login_2fa(
    payload: TwoFactorLoginRequest, request: Request, db: Session = Depends(get_db)
) -> TokenResponse:
    return auth.login_2fa(db, payload, request.headers.get("user-agent", ""), _client_ip(request))


def me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserMe:
    return auth.me(db, current_user)


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


def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    auth.change_password(db, current_user, payload)


def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SessionOut]:
    return auth.list_sessions(db, current_user)


def revoke_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    auth.revoke_session(db, current_user, session_id)

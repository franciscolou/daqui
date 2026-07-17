from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin, get_db
from app.models.admin import AdAdmin
from app.schemas.auth import (
    AdAdminMe,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    ResetPasswordRequest,
    TokenResponse,
    TwoFactorCodeRequest,
    TwoFactorLoginRequest,
    TwoFactorSetupResponse,
)
from app.services import auth as auth_service


def me(current_admin: AdAdmin = Depends(get_current_admin)) -> AdAdminMe:
    return auth_service.me(current_admin)


def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    return auth_service.login(db, payload)


def login_2fa(payload: TwoFactorLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return auth_service.login_2fa(db, payload)


def two_factor_setup(
    db: Session = Depends(get_db),
    current_admin: AdAdmin = Depends(get_current_admin),
) -> TwoFactorSetupResponse:
    return auth_service.start_2fa_setup(db, current_admin)


def two_factor_enable(
    payload: TwoFactorCodeRequest,
    db: Session = Depends(get_db),
    current_admin: AdAdmin = Depends(get_current_admin),
) -> None:
    auth_service.enable_2fa(db, current_admin, payload.code)


def two_factor_disable(
    payload: TwoFactorCodeRequest,
    db: Session = Depends(get_db),
    current_admin: AdAdmin = Depends(get_current_admin),
) -> None:
    auth_service.disable_2fa(db, current_admin, payload.code)


def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> None:
    auth_service.forgot_password(db, payload)


def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> None:
    auth_service.reset_password(db, payload)

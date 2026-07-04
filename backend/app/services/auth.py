from email_validator import EmailNotValidError, validate_email
from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core import totp
from app.core import username as username_lib
from app.core.deps import suspension_message
from app.core.security import (
    create_2fa_ticket,
    create_access_token,
    decode_2fa_ticket,
    hash_password,
    verify_password,
)
from app.daos import user as user_dao
from app.models.user import User
from app.schemas.auth import (
    AvailabilityResponse,
    LoginRequest,
    LoginResponse,
    SignupRequest,
    TokenResponse,
    TwoFactorLoginRequest,
    TwoFactorSetupResponse,
)
from app.schemas.user import UserMe
from app.services import notification as notification_service

_USERNAME_TAKEN = "Este nome de usuário já está em uso."
_EMAIL_TAKEN = "Este e-mail já está cadastrado."


def check_username(db: Session, value: str) -> AvailabilityResponse:
    error = username_lib.validation_error(value)
    if error:
        return AvailabilityResponse(available=False, error=error)
    if user_dao.get_by_username(db, username_lib.normalize(value)):
        return AvailabilityResponse(available=False, error=_USERNAME_TAKEN)
    return AvailabilityResponse(available=True)


def check_email(db: Session, value: str) -> AvailabilityResponse:
    raw = (value or "").strip()
    try:
        validate_email(raw, check_deliverability=False)
    except EmailNotValidError:
        return AvailabilityResponse(available=False, error="E-mail inválido.")
    if user_dao.get_by_email(db, raw):
        return AvailabilityResponse(available=False, error=_EMAIL_TAKEN)
    return AvailabilityResponse(available=True)


def signup(db: Session, payload: SignupRequest) -> TokenResponse:
    if user_dao.get_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail=_EMAIL_TAKEN)

    uname = username_lib.normalize(payload.username)
    error = username_lib.validation_error(uname)
    if error:
        raise HTTPException(status_code=400, detail=error)
    if user_dao.get_by_username(db, uname):
        raise HTTPException(status_code=400, detail=_USERNAME_TAKEN)

    user = user_dao.create(
        db,
        username=uname,
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        neighborhood=payload.neighborhood,
        city=payload.city,
        state=payload.state,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    return TokenResponse(access_token=create_access_token(user.id))


def login(db: Session, payload: LoginRequest) -> LoginResponse:
    user = user_dao.get_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
        )
    if user.is_currently_suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=suspension_message(user))
    if user.totp_enabled:
        # Senha ok, mas a A2F exige um segundo passo: devolve um ticket curto.
        return LoginResponse(requires_2fa=True, ticket=create_2fa_ticket(user.id))
    return LoginResponse(access_token=create_access_token(user.id))


def login_2fa(db: Session, payload: TwoFactorLoginRequest) -> TokenResponse:
    try:
        user_id = int(decode_2fa_ticket(payload.ticket))
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão de verificação expirada. Entre novamente.",
        )
    user = user_dao.get_by_id(db, user_id)
    if not user or not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Verificação inválida")
    if not totp.verify(user.totp_secret, payload.code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Código inválido")
    if user.is_currently_suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=suspension_message(user))
    return TokenResponse(access_token=create_access_token(user.id))


def me(db: Session, user: User) -> UserMe:
    """Perfil do usuário logado + aviso de moderação pendente (consumido aqui)."""
    notice = notification_service.consume_moderation_notice(db, user)
    user.pending_notice = notice
    return UserMe.model_validate(user)


def start_2fa_setup(db: Session, user: User) -> TwoFactorSetupResponse:
    if user.totp_enabled:
        raise HTTPException(status_code=400, detail="A autenticação de dois fatores já está ativa")
    secret = totp.generate_secret()
    # Guarda o segredo pendente; só passa a valer após confirmar um código.
    user_dao.update(db, user, {"totp_secret": secret, "totp_enabled": False})
    return TwoFactorSetupResponse(
        secret=secret,
        otpauth_url=totp.provisioning_uri(secret, account=user.email),
    )


def enable_2fa(db: Session, user: User, code: str) -> None:
    if user.totp_enabled:
        raise HTTPException(status_code=400, detail="A autenticação de dois fatores já está ativa")
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="Inicie a configuração da A2F antes de confirmar")
    if not totp.verify(user.totp_secret, code):
        raise HTTPException(status_code=400, detail="Código inválido. Tente novamente.")
    user_dao.update(db, user, {"totp_enabled": True})


def disable_2fa(db: Session, user: User, code: str) -> None:
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status_code=400, detail="A autenticação de dois fatores não está ativa")
    if not totp.verify(user.totp_secret, code):
        raise HTTPException(status_code=400, detail="Código inválido. Tente novamente.")
    user_dao.update(db, user, {"totp_secret": None, "totp_enabled": False})

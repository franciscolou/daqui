import re

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core import totp
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
    LoginRequest,
    LoginResponse,
    SignupRequest,
    TokenResponse,
    TwoFactorLoginRequest,
    TwoFactorSetupResponse,
)


def _generate_username(db: Session, email: str, name: str) -> str:
    base = re.sub(r"[^a-z0-9._]", "", (email.split("@")[0] or name).lower()) or "user"
    base = base[:26]
    if len(base) < 3:
        base = f"{base}user"[:26]
    candidate = base
    suffix = 1
    while user_dao.get_by_username(db, candidate):
        candidate = f"{base}{suffix}"
        suffix += 1
    return candidate


def signup(db: Session, payload: SignupRequest) -> TokenResponse:
    if user_dao.get_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    user = user_dao.create(
        db,
        username=_generate_username(db, payload.email, payload.name),
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
    return TokenResponse(access_token=create_access_token(user.id))


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

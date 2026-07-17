from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: Any) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": str(subject), "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> str:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if payload.get("scope"):
        # Tickets de propósito único (A2F, redefinição de senha) nunca valem
        # como token de acesso.
        raise JWTError("Token de acesso inválido")
    return payload["sub"]


# Ticket curto emitido após senha correta quando a A2F está ativa; só serve
# para completar o login em /auth/login/2fa (não autentica requisições).
_TWOFA_TICKET_MINUTES = 5


def create_2fa_ticket(subject: Any) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=_TWOFA_TICKET_MINUTES)
    payload = {"sub": str(subject), "scope": "2fa", "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_2fa_ticket(token: str) -> str:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if payload.get("scope") != "2fa":
        raise JWTError("Ticket de A2F inválido")
    return payload["sub"]


# Token enviado por e-mail (link de redefinição de senha) — vale por 20 min.
_PASSWORD_RESET_TOKEN_MINUTES = 20


def create_password_reset_token(subject: Any) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=_PASSWORD_RESET_TOKEN_MINUTES)
    payload = {"sub": str(subject), "scope": "password_reset", "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_password_reset_token(token: str) -> str:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if payload.get("scope") != "password_reset":
        raise JWTError("Link de redefinição inválido")
    return payload["sub"]

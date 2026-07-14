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


def create_access_token(subject: Any, jti: str | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": str(subject), "exp": expire}
    if jti:
        # Liga o token a uma sessão (ver models.session.UserSession) para permitir
        # listar/desconectar dispositivos em "Configurações > Dispositivos conectados".
        payload["jti"] = jti
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _decode_access_payload(token: str) -> dict:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if payload.get("scope"):
        # Tickets de propósito único (A2F, verificação de e-mail, redefinição
        # de senha) nunca valem como token de acesso.
        raise JWTError("Token de acesso inválido")
    return payload


def decode_token(token: str) -> str:
    return _decode_access_payload(token)["sub"]


def decode_token_claims(token: str) -> dict:
    """Payload completo (sub + jti quando presente) — usado para checar a sessão."""
    return _decode_access_payload(token)


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


# Ticket emitido no cadastro (ou num login com e-mail ainda não confirmado);
# só serve para completar a verificação em /auth/verify-email. O código de 6
# dígitos em si (10 min) fica hasheado no usuário — ver services/auth.py.
_EMAIL_VERIFY_TICKET_MINUTES = 30


def create_email_verify_ticket(subject: Any) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=_EMAIL_VERIFY_TICKET_MINUTES)
    payload = {"sub": str(subject), "scope": "email_verify", "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_email_verify_ticket(token: str) -> str:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if payload.get("scope") != "email_verify":
        raise JWTError("Ticket de verificação inválido")
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

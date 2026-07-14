import secrets
import uuid
from datetime import datetime, timedelta, timezone

from email_validator import EmailNotValidError, validate_email
from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core import totp
from app.core import username as username_lib
from app.core.config import settings
from app.core.deps import suspension_message
from app.core.email import send_email
from app.core.security import (
    create_2fa_ticket,
    create_access_token,
    create_email_verify_ticket,
    create_password_reset_token,
    decode_2fa_ticket,
    decode_email_verify_ticket,
    decode_password_reset_token,
    hash_password,
    verify_password,
)
from app.core.user_agent import parse_device_name
from app.daos import session as session_dao
from app.daos import user as user_dao
from app.models.user import User
from app.schemas.auth import (
    AvailabilityResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    TwoFactorLoginRequest,
    TwoFactorSetupResponse,
    VerificationTicketResponse,
    VerifyEmailRequest,
)
from app.schemas.session import SessionOut
from app.schemas.user import UserMe
from app.services import notification as notification_service

_USERNAME_TAKEN = "Este nome de usuário já está em uso."
_EMAIL_TAKEN = "Este e-mail já está cadastrado."
_MIN_PASSWORD_LEN = 6
_VERIFICATION_CODE_MINUTES = 10
_VERIFICATION_TICKET_INVALID = "Sessão de verificação expirada. Volte e informe seu e-mail e senha novamente."


def _start_session(db: Session, user: User, user_agent: str, ip_address: str | None) -> str:
    jti = uuid.uuid4().hex
    session_dao.create(
        db,
        user_id=user.id,
        jti=jti,
        device_name=parse_device_name(user_agent),
        user_agent=(user_agent or "")[:500],
        ip_address=ip_address,
    )
    return jti


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


def _send_verification_code(db: Session, user: User) -> str:
    """Gera um código de 6 dígitos (10 min), envia por e-mail e devolve o
    ticket que identifica essa verificação pendente (30 min, ver
    create_email_verify_ticket) — usado por signup/login/resend."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    user_dao.update(
        db,
        user,
        {
            "verification_code_hash": hash_password(code),
            "verification_code_expires_at": datetime.now(timezone.utc)
            + timedelta(minutes=_VERIFICATION_CODE_MINUTES),
        },
    )
    send_email(
        user.email,
        "Confirme seu e-mail — Daqui",
        f"<p>Olá {user.name}, seu código de verificação do Daqui é:</p>"
        f"<h2>{code}</h2>"
        f"<p>Ele vale por {_VERIFICATION_CODE_MINUTES} minutos.</p>",
    )
    return create_email_verify_ticket(user.id)


def signup(
    db: Session, payload: SignupRequest, user_agent: str = "", ip_address: str | None = None
) -> VerificationTicketResponse:
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
    ticket = _send_verification_code(db, user)
    return VerificationTicketResponse(ticket=ticket)


def verify_email(
    db: Session,
    payload: VerifyEmailRequest,
    user_agent: str = "",
    ip_address: str | None = None,
) -> TokenResponse:
    try:
        user_id = int(decode_email_verify_ticket(payload.ticket))
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail=_VERIFICATION_TICKET_INVALID) from None
    user = user_dao.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail=_VERIFICATION_TICKET_INVALID)

    if not user.email_verified:
        expires = user.verification_code_expires_at
        if expires is not None and expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if (
            not user.verification_code_hash
            or expires is None
            or expires < datetime.now(timezone.utc)
        ):
            raise HTTPException(
                status_code=400, detail="Código expirado. Solicite um novo."
            )
        if not verify_password(payload.code, user.verification_code_hash):
            raise HTTPException(status_code=400, detail="Código inválido.")
        user_dao.update(
            db,
            user,
            {
                "email_verified": True,
                "verification_code_hash": None,
                "verification_code_expires_at": None,
            },
        )

    jti = _start_session(db, user, user_agent, ip_address)
    return TokenResponse(access_token=create_access_token(user.id, jti))


def resend_verification(
    db: Session, payload: ResendVerificationRequest
) -> VerificationTicketResponse:
    try:
        user_id = int(decode_email_verify_ticket(payload.ticket))
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail=_VERIFICATION_TICKET_INVALID) from None
    user = user_dao.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail=_VERIFICATION_TICKET_INVALID)
    if user.email_verified:
        raise HTTPException(status_code=400, detail="Este e-mail já foi verificado.")
    ticket = _send_verification_code(db, user)
    return VerificationTicketResponse(ticket=ticket)


def forgot_password(db: Session, payload: ForgotPasswordRequest) -> None:
    user = user_dao.get_by_email(db, payload.email)
    if user:
        token = create_password_reset_token(user.id)
        link = f"{settings.FRONTEND_URL}/redefinir-senha?token={token}"
        send_email(
            user.email,
            "Redefinição de senha — Daqui",
            f"<p>Olá {user.name}, clique no link abaixo para escolher uma nova senha. "
            f"Ele vale por 20 minutos:</p>"
            f'<p><a href="{link}">{link}</a></p>'
            f"<p>Se você não pediu isso, ignore este e-mail.</p>",
        )
    # Sempre "sucesso" (mesmo se o e-mail não existir) — evita enumeração de contas.


def reset_password(db: Session, payload: ResetPasswordRequest) -> None:
    try:
        user_id = int(decode_password_reset_token(payload.token))
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=400, detail="Link inválido ou expirado. Solicite um novo."
        ) from None
    user = user_dao.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Link inválido ou expirado.")
    if len(payload.new_password) < _MIN_PASSWORD_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"A nova senha deve ter ao menos {_MIN_PASSWORD_LEN} caracteres",
        )
    user_dao.update(db, user, {"hashed_password": hash_password(payload.new_password)})
    session_dao.revoke_all_for_user(db, user.id)


def login(
    db: Session, payload: LoginRequest, user_agent: str = "", ip_address: str | None = None
) -> LoginResponse:
    user = user_dao.get_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
        )
    if user.is_currently_suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=suspension_message(user))
    if not user.email_verified:
        ticket = _send_verification_code(db, user)
        return LoginResponse(requires_verification=True, ticket=ticket)
    if user.totp_enabled:
        # Senha ok, mas a A2F exige um segundo passo: devolve um ticket curto.
        return LoginResponse(requires_2fa=True, ticket=create_2fa_ticket(user.id))
    jti = _start_session(db, user, user_agent, ip_address)
    return LoginResponse(access_token=create_access_token(user.id, jti))


def login_2fa(
    db: Session,
    payload: TwoFactorLoginRequest,
    user_agent: str = "",
    ip_address: str | None = None,
) -> TokenResponse:
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
    jti = _start_session(db, user, user_agent, ip_address)
    return TokenResponse(access_token=create_access_token(user.id, jti))


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


def change_password(db: Session, user: User, payload: ChangePasswordRequest) -> None:
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    if len(payload.new_password) < _MIN_PASSWORD_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"A nova senha deve ter ao menos {_MIN_PASSWORD_LEN} caracteres",
        )
    user_dao.update(db, user, {"hashed_password": hash_password(payload.new_password)})


def list_sessions(db: Session, user: User) -> list[SessionOut]:
    current_id = getattr(user, "current_session_id", None)
    sessions = session_dao.list_active_for_user(db, user.id)
    return [
        SessionOut(
            id=s.id,
            device_name=s.device_name or "Dispositivo desconhecido",
            created_at=s.created_at,
            is_current=s.id == current_id,
        )
        for s in sessions
    ]


def revoke_session(db: Session, user: User, session_id: int) -> None:
    session = session_dao.get_by_id(db, session_id)
    if not session or session.user_id != user.id or session.revoked_at is not None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    if session.id == getattr(user, "current_session_id", None):
        raise HTTPException(
            status_code=400, detail="Não é possível desconectar a sessão atual por aqui"
        )
    session_dao.revoke(db, session)

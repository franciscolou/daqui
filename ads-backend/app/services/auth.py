from fastapi import HTTPException
from jose import JWTError

from app.core import totp
from app.core.config import settings
from app.core.email import send_email
from app.core.security import (
    create_2fa_ticket,
    create_access_token,
    create_password_reset_token,
    decode_2fa_ticket,
    decode_password_reset_token,
    hash_password,
    verify_password,
)
from app.daos import admin as admin_dao
from app.models.admin import AdAdmin
from app.schemas.auth import (
    AdAdminMe,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    ResetPasswordRequest,
    TokenResponse,
    TwoFactorLoginRequest,
    TwoFactorSetupResponse,
)

_MIN_PASSWORD_LEN = 6


def me(admin: AdAdmin) -> AdAdminMe:
    return AdAdminMe(email=admin.email, two_factor_enabled=admin.totp_enabled)


def login(db, payload: LoginRequest) -> LoginResponse:
    admin = admin_dao.get_by_email(db, payload.email)
    if not admin or not verify_password(payload.password, admin.hashed_password):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    if admin.totp_enabled:
        # Senha ok, mas a A2F exige um segundo passo: devolve um ticket curto.
        return LoginResponse(requires_2fa=True, ticket=create_2fa_ticket(admin.id))
    return LoginResponse(access_token=create_access_token(admin.id))


def login_2fa(db, payload: TwoFactorLoginRequest) -> TokenResponse:
    try:
        admin_id = int(decode_2fa_ticket(payload.ticket))
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=401, detail="Sessão de verificação expirada. Entre novamente."
        ) from None
    admin = admin_dao.get_by_id(db, admin_id)
    if not admin or not admin.totp_enabled or not admin.totp_secret:
        raise HTTPException(status_code=401, detail="Verificação inválida")
    if not totp.verify(admin.totp_secret, payload.code):
        raise HTTPException(status_code=401, detail="Código inválido")
    return TokenResponse(access_token=create_access_token(admin.id))


def start_2fa_setup(db, admin: AdAdmin) -> TwoFactorSetupResponse:
    if admin.totp_enabled:
        raise HTTPException(status_code=400, detail="A autenticação de dois fatores já está ativa")
    secret = totp.generate_secret()
    # Guarda o segredo pendente; só passa a valer após confirmar um código.
    admin_dao.update(db, admin, {"totp_secret": secret, "totp_enabled": False})
    return TwoFactorSetupResponse(
        secret=secret,
        otpauth_url=totp.provisioning_uri(secret, account=admin.email),
    )


def enable_2fa(db, admin: AdAdmin, code: str) -> None:
    if admin.totp_enabled:
        raise HTTPException(status_code=400, detail="A autenticação de dois fatores já está ativa")
    if not admin.totp_secret:
        raise HTTPException(status_code=400, detail="Inicie a configuração da A2F antes de confirmar")
    if not totp.verify(admin.totp_secret, code):
        raise HTTPException(status_code=400, detail="Código inválido. Tente novamente.")
    admin_dao.update(db, admin, {"totp_enabled": True})


def disable_2fa(db, admin: AdAdmin, code: str) -> None:
    if not admin.totp_enabled or not admin.totp_secret:
        raise HTTPException(status_code=400, detail="A autenticação de dois fatores não está ativa")
    if not totp.verify(admin.totp_secret, code):
        raise HTTPException(status_code=400, detail="Código inválido. Tente novamente.")
    admin_dao.update(db, admin, {"totp_secret": None, "totp_enabled": False})


def forgot_password(db, payload: ForgotPasswordRequest) -> None:
    admin = admin_dao.get_by_email(db, payload.email)
    if admin:
        token = create_password_reset_token(admin.id)
        link = f"{settings.ADS_ADMIN_URL}/?reset_token={token}"
        send_email(
            admin.email,
            "Redefinição de senha — Anúncios Daqui",
            f"<p>Olá, clique no link abaixo para escolher uma nova senha. "
            f"Ele vale por 20 minutos:</p>"
            f'<p><a href="{link}">{link}</a></p>'
            f"<p>Se você não pediu isso, ignore este e-mail.</p>",
        )
    # Sempre "sucesso" (mesmo se o e-mail não existir) — evita enumeração de contas.


def reset_password(db, payload: ResetPasswordRequest) -> None:
    try:
        admin_id = int(decode_password_reset_token(payload.token))
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=400, detail="Link inválido ou expirado. Solicite um novo."
        ) from None
    admin = admin_dao.get_by_id(db, admin_id)
    if not admin:
        raise HTTPException(status_code=400, detail="Link inválido ou expirado.")
    if len(payload.new_password) < _MIN_PASSWORD_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"A nova senha deve ter ao menos {_MIN_PASSWORD_LEN} caracteres",
        )
    admin_dao.update(db, admin, {"hashed_password": hash_password(payload.new_password)})

from typing import Optional

from pydantic import BaseModel, EmailStr


class SignupRequest(BaseModel):
    name: str
    username: str
    email: EmailStr
    password: str
    neighborhood: str = ""
    city: str = "São Paulo"
    state: str = "SP"
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AvailabilityResponse(BaseModel):
    # available=True quando o valor é válido E está livre.
    # error traz a mensagem (formato inválido ou já em uso) quando available=False.
    available: bool
    error: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    # Login "limpo": vem com access_token. E-mail ainda não confirmado:
    # requires_verification=True + ticket (completa em /auth/verify-email).
    # Com A2F: requires_2fa=True + ticket (completa em /auth/login/2fa).
    requires_verification: bool = False
    requires_2fa: bool = False
    ticket: str | None = None
    access_token: str | None = None
    token_type: str = "bearer"


class TwoFactorLoginRequest(BaseModel):
    ticket: str
    code: str


class TwoFactorSetupResponse(BaseModel):
    secret: str
    otpauth_url: str


class TwoFactorCodeRequest(BaseModel):
    code: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ── Verificação de e-mail (cadastro) ────────────────────────────────────
class VerificationTicketResponse(BaseModel):
    # Devolvido no cadastro e no reenvio: identifica a verificação pendente,
    # sem autenticar (ver create_email_verify_ticket).
    ticket: str


class VerifyEmailRequest(BaseModel):
    ticket: str
    code: str


class ResendVerificationRequest(BaseModel):
    ticket: str


# ── Redefinição de senha ─────────────────────────────────────────────────
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# ── "Entrar com Google" ──────────────────────────────────────────────────
class GoogleAuthRequest(BaseModel):
    id_token: str


class GoogleAuthResponse(BaseModel):
    # Conta já existia (ou acabou de ser vinculada por e-mail já verificado
    # pelo Google): vem com access_token, login completo.
    # Conta nova: falta escolher um nome de usuário — signup_ticket completa
    # em /auth/google/complete-signup. `name` vem junto (mesmo valor gravado
    # no ticket) só pra o passo de completar cadastro pré-preencher o campo
    # de nome sem precisar decodificar o JWT no cliente.
    needs_username: bool = False
    signup_ticket: str | None = None
    name: str | None = None
    access_token: str | None = None
    token_type: str = "bearer"


class GoogleCompleteSignupRequest(BaseModel):
    signup_ticket: str
    username: str
    # Pré-preenchido no app com o nome que veio do Google (ver
    # GoogleAuthResponse.name acima), mas editável pelo usuário nesse passo —
    # por isso viaja de novo aqui em vez de o backend reusar cegamente o nome
    # gravado no ticket.
    name: str

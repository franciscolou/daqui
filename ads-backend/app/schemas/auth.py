from pydantic import BaseModel, EmailStr

from app.models.admin import AdAdminRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    # Login "limpo": vem com access_token. Com A2F: requires_2fa=True + ticket
    # (completa em /auth/login/2fa).
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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class AdAdminMe(BaseModel):
    email: EmailStr
    username: str
    avatar_url: str | None = None
    two_factor_enabled: bool
    role: AdAdminRole

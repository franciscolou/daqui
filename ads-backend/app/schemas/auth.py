from pydantic import BaseModel, EmailStr


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


class AdAdminMe(BaseModel):
    email: EmailStr
    two_factor_enabled: bool

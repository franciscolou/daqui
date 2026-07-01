from pydantic import BaseModel, EmailStr


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    neighborhood: str = ""
    city: str = "São Paulo"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    # Login sem A2F: vem com access_token. Com A2F: requires_2fa=True + ticket.
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

from fastapi import APIRouter

from app.controllers import auth
from app.schemas.auth import LoginResponse, TokenResponse, TwoFactorSetupResponse
from app.schemas.user import UserMe

router = APIRouter(prefix="/auth", tags=["auth"])

router.post("/signup",      response_model=TokenResponse, status_code=201)(auth.signup)
router.post("/login",       response_model=LoginResponse)(auth.login)
router.post("/login/2fa",   response_model=TokenResponse)(auth.login_2fa)
router.get( "/me",          response_model=UserMe)(auth.me)
router.post("/2fa/setup",   response_model=TwoFactorSetupResponse)(auth.two_factor_setup)
router.post("/2fa/enable",  response_model=UserMe)(auth.two_factor_enable)
router.post("/2fa/disable", response_model=UserMe)(auth.two_factor_disable)

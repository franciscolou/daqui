from fastapi import APIRouter

from app.controllers import auth
from app.schemas.auth import AdAdminMe, LoginResponse, TokenResponse, TwoFactorSetupResponse

router = APIRouter(prefix="/auth", tags=["auth"])

router.get( "/me",              response_model=AdAdminMe)(auth.me)
router.post("/login",           response_model=LoginResponse)(auth.login)
router.post("/login/2fa",       response_model=TokenResponse)(auth.login_2fa)
router.post("/2fa/setup",       response_model=TwoFactorSetupResponse)(auth.two_factor_setup)
router.post("/2fa/enable",      status_code=204)(auth.two_factor_enable)
router.post("/2fa/disable",     status_code=204)(auth.two_factor_disable)
router.post("/forgot-password", status_code=204)(auth.forgot_password)
router.post("/reset-password",  status_code=204)(auth.reset_password)

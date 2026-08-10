from fastapi import APIRouter

from app.controllers import ad_admin_auth as auth
from app.schemas.ad_auth import (
    AdAdminMe,
    LoginResponse,
    TokenResponse,
    TwoFactorSetupResponse,
)

router = APIRouter(prefix="/ads-admin/auth", tags=["ads-admin"])

router.get( "/me",              response_model=AdAdminMe)(auth.me)
router.post("/login",           response_model=LoginResponse)(auth.login)
router.post("/login/2fa",       response_model=TokenResponse)(auth.login_2fa)
router.post("/2fa/setup",       response_model=TwoFactorSetupResponse)(auth.two_factor_setup)
router.post("/2fa/enable",      status_code=204)(auth.two_factor_enable)
router.post("/2fa/disable",     status_code=204)(auth.two_factor_disable)
router.post("/forgot-password", status_code=204)(auth.forgot_password)
router.post("/reset-password",  status_code=204)(auth.reset_password)
router.post("/change-password", status_code=204)(auth.change_password)
router.post(  "/me/avatar",     response_model=AdAdminMe)(auth.update_avatar)
router.delete("/me/avatar",     response_model=AdAdminMe)(auth.remove_avatar)

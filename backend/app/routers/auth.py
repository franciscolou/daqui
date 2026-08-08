from fastapi import APIRouter

from app.controllers import auth
from app.schemas.auth import (
    AvailabilityResponse,
    GoogleAuthResponse,
    LoginResponse,
    TokenResponse,
    TwoFactorSetupResponse,
    VerificationTicketResponse,
)
from app.schemas.session import SessionOut
from app.schemas.user import CommunityStats, UserMe

router = APIRouter(prefix="/auth", tags=["auth"])

router.post("/signup",         response_model=VerificationTicketResponse, status_code=201)(auth.signup)
router.get( "/check-username", response_model=AvailabilityResponse)(auth.check_username)
router.get( "/check-email",    response_model=AvailabilityResponse)(auth.check_email)
router.get( "/community-stats", response_model=CommunityStats)(auth.community_stats)
router.post("/verify-email",         response_model=TokenResponse)(auth.verify_email)
router.post("/resend-verification",  response_model=VerificationTicketResponse)(auth.resend_verification)
router.post("/forgot-password", status_code=204)(auth.forgot_password)
router.post("/reset-password",  status_code=204)(auth.reset_password)
router.post("/login",       response_model=LoginResponse)(auth.login)
router.post("/login/2fa",   response_model=TokenResponse)(auth.login_2fa)
router.post("/google",                 response_model=GoogleAuthResponse)(auth.google_auth)
router.post("/google/complete-signup", response_model=TokenResponse)(auth.google_complete_signup)
router.get( "/me",          response_model=UserMe)(auth.me)
router.post("/logout", status_code=204)(auth.logout)
router.post("/2fa/setup",   response_model=TwoFactorSetupResponse)(auth.two_factor_setup)
router.post("/2fa/enable",  response_model=UserMe)(auth.two_factor_enable)
router.post("/2fa/disable", response_model=UserMe)(auth.two_factor_disable)
router.post("/change-password", status_code=204)(auth.change_password)
router.get(   "/sessions",         response_model=list[SessionOut])(auth.list_sessions)
router.delete("/sessions/{session_id}", status_code=204)(auth.revoke_session)

from fastapi import APIRouter

from app.controllers import auth
from app.schemas.auth import TokenResponse
from app.schemas.user import UserMe

router = APIRouter(prefix="/auth", tags=["auth"])

router.post("/signup", response_model=TokenResponse, status_code=201)(auth.signup)
router.post("/login",  response_model=TokenResponse)(auth.login)
router.get( "/me",     response_model=UserMe)(auth.me)

from fastapi import APIRouter

from app.controllers import auth
from app.schemas.auth import LoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])

router.post("/login", response_model=LoginResponse)(auth.login)

from fastapi import HTTPException

from app.core.security import create_access_token, verify_password
from app.daos import admin as admin_dao
from app.schemas.auth import LoginRequest, LoginResponse


def login(db, payload: LoginRequest) -> LoginResponse:
    admin = admin_dao.get_by_email(db, payload.email)
    if not admin or not verify_password(payload.password, admin.hashed_password):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    return LoginResponse(access_token=create_access_token(admin.id))

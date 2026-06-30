from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.daos import user
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse


def signup(db: Session, payload: SignupRequest) -> TokenResponse:
    if user.get_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    user = user.create(
        db,
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        neighborhood=payload.neighborhood,
        city=payload.city,
    )
    return TokenResponse(access_token=create_access_token(user.id))


def login(db: Session, payload: LoginRequest) -> TokenResponse:
    user = user.get_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
        )
    return TokenResponse(access_token=create_access_token(user.id))

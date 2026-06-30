from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.daos import user
from app.models.user import User
from app.schemas.user import UserUpdate


def get_neighbors(db: Session, user: User) -> list[User]:
    return user.get_neighbors(db, user.neighborhood, exclude_id=user.id)


def get_by_id(db: Session, user_id: int) -> User:
    user = user.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user


def update_me(db: Session, user: User, payload: UserUpdate) -> User:
    return user.update(db, user, payload.model_dump(exclude_none=True))

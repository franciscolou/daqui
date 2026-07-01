from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.uploads import save_data_url_image
from app.daos import post as post_dao
from app.daos import user as user_dao
from app.models.user import User
from app.schemas.user import (
    USERNAME_RE,
    NeighborhoodStats,
    UsernameAvailability,
    UserUpdate,
)


def get_neighbors(db: Session, user: User) -> list[User]:
    return user_dao.get_neighbors(db, user.neighborhood, exclude_id=user.id)


def get_popular(db: Session, user: User) -> list[User]:
    return user_dao.get_popular(db, exclude_id=user.id)


def get_by_id(db: Session, user_id: int) -> User:
    user = user_dao.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user


def check_username(db: Session, user: User, username: str) -> UsernameAvailability:
    normalized = username.strip().lower()
    valid = bool(USERNAME_RE.match(normalized))
    available = False
    if valid:
        existing = user_dao.get_by_username(db, normalized)
        available = existing is None or existing.id == user.id
    return UsernameAvailability(username=normalized, valid=valid, available=available)


def get_neighborhood_stats(db: Session, user: User) -> NeighborhoodStats:
    return NeighborhoodStats(
        neighborhood=user.neighborhood,
        neighbors=user_dao.count_by_neighborhood(db, user.neighborhood),
        posts=post_dao.count_feed(db, user.neighborhood, None),
    )


def update_me(db: Session, user: User, payload: UserUpdate) -> User:
    data = payload.model_dump(exclude_none=True)

    new_username = data.get("username")
    if new_username and new_username != user.username:
        existing = user_dao.get_by_username(db, new_username)
        if existing and existing.id != user.id:
            raise HTTPException(status_code=409, detail="Este nome de usuário já está em uso")

    return user_dao.update(db, user, data)


def update_avatar(db: Session, user: User, base_url: str, data_url: str) -> User:
    avatar_url = save_data_url_image(base_url, data_url, prefix=str(user.id))
    return user_dao.update(db, user, {"avatar_url": avatar_url})

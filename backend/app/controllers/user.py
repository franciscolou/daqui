from fastapi import Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.deps import get_current_moderator, get_current_user, get_db
from app.models.user import User
from app.schemas.user import (
    AvatarUpdate,
    CoverUpdate,
    NeighborhoodStats,
    UserAdminOut,
    UsernameAvailability,
    UserPublic,
    UserSuspendIn,
    UserUpdate,
)
from app.services import user


def list_neighbors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserPublic]:
    return user.get_neighbors(db, current_user)


def list_popular(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserPublic]:
    return user.get_popular(db, current_user)


def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    return user.get_by_id(db, current_user, user_id)


def update_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    return user.update_me(db, current_user, payload)


def check_username(
    username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UsernameAvailability:
    return user.check_username(db, current_user, username)


def neighborhood_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NeighborhoodStats:
    return user.get_neighborhood_stats(db, current_user)


def update_avatar(
    payload: AvatarUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    return user.update_avatar(db, current_user, str(request.base_url), payload.image)


def update_cover(
    payload: CoverUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    return user.update_cover(db, current_user, str(request.base_url), payload.image)


# ── Moderador (app de moderação) ──────────────────────────────────────
def admin_get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> UserAdminOut:
    return user.admin_get(db, user_id)


def admin_search_users(
    q: str = Query("", description="Nome ou @username"),
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> list[UserAdminOut]:
    return user.admin_search(db, q)


def admin_suspend_user(
    user_id: int,
    payload: UserSuspendIn,
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> UserAdminOut:
    return user.admin_suspend(db, user_id, payload, _mod)


def admin_unsuspend_user(
    user_id: int,
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> UserAdminOut:
    return user.admin_unsuspend(db, user_id, _mod)

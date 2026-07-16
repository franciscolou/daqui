from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core import realtime_registry
from app.core.uploads import save_data_url_image
from app.daos import post as post_dao
from app.daos import user as user_dao
from app.models.audit_log import ACTION_USER_SUSPEND, ACTION_USER_UNSUSPEND
from app.models.user import User
from app.schemas.user import (
    USERNAME_RE,
    NeighborhoodStats,
    UserAdminOut,
    UsernameAvailability,
    UserPublic,
    UserSuspendIn,
    UserUpdate,
)
from app.services import audit_log as audit_log_service


def public_view(viewer: User, target: User) -> UserPublic:
    """Serializa um usuário. Qualquer usuário pode ver o perfil completo de
    qualquer bairro — o isolamento fica só no feed."""
    return UserPublic.model_validate(target)


def get_neighbors(db: Session, user: User) -> list[User]:
    return user_dao.get_neighbors(db, user.neighborhood, exclude_id=user.id)


def get_popular(db: Session, user: User) -> list[User]:
    # Restrito ao bairro do usuário (widget "Vizinhos em destaque").
    return user_dao.get_popular(db, neighborhood=user.neighborhood, exclude_id=user.id)


def get_by_id(db: Session, viewer: User, user_id: int) -> UserPublic:
    user = user_dao.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return public_view(viewer, user)


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
        posts=post_dao.count_feed(db, [user.neighborhood], None),
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


def update_cover(db: Session, user: User, base_url: str, data_url: str) -> User:
    cover_url = save_data_url_image(base_url, data_url, prefix=f"{user.id}_cover")
    return user_dao.update(db, user, {"cover_url": cover_url})


# ── Moderação ─────────────────────────────────────────────────────────
def _admin_out(u: User) -> UserAdminOut:
    base = UserPublic.model_validate(u)
    return UserAdminOut(
        **base.model_dump(),
        is_suspended=u.is_currently_suspended,
        suspended_until=u.suspended_until,
        suspension_reason=u.suspension_reason or None,
    )


def admin_get(db: Session, user_id: int) -> UserAdminOut:
    target = user_dao.get_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return _admin_out(target)


def admin_search(db: Session, query: str) -> list[UserAdminOut]:
    query = query.strip()
    if not query:
        return []
    # Busca irrestrita a bairro: o moderador precisa achar qualquer usuário.
    users = user_dao.search(db, query, limit=30)
    return [_admin_out(u) for u in users]


def admin_suspend(db: Session, user_id: int, payload: UserSuspendIn, moderator: User) -> UserAdminOut:
    target = user_dao.get_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if target.is_moderator:
        raise HTTPException(status_code=400, detail="Não é possível suspender um moderador")

    until = payload.until
    if until is not None:
        if until.tzinfo is None:
            until = until.replace(tzinfo=timezone.utc)
        if until <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="A data de suspensão deve estar no futuro")

    reason = (payload.reason or "").strip()
    user_dao.update(
        db,
        target,
        {"is_suspended": True, "suspended_until": until, "suspension_reason": reason},
    )

    period = "por tempo indeterminado" if until is None else f"até {until.strftime('%d/%m/%Y %H:%M')}"
    detail = f"Suspensão {period}" + (f" — {reason}" if reason else "")
    audit_log_service.log(db, moderator, ACTION_USER_SUSPEND, target.id, detail)
    realtime_registry.wake(target.id)
    return _admin_out(target)


def admin_unsuspend(db: Session, user_id: int, moderator: User) -> UserAdminOut:
    target = user_dao.get_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    user_dao.update(
        db, target, {"is_suspended": False, "suspended_until": None, "suspension_reason": ""}
    )
    audit_log_service.log(db, moderator, ACTION_USER_UNSUSPEND, target.id, "Suspensão revogada")
    return _admin_out(target)

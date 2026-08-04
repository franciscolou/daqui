import secrets
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core import realtime_registry
from app.core.security import hash_password
from app.core.uploads import save_data_url_image
from app.daos import mention as mention_dao
from app.daos import post as post_dao
from app.daos import user as user_dao
from app.models.audit_log import AuditLogAction
from app.models.user import User
from app.schemas.user import (
    USERNAME_RE,
    CommunityStats,
    NeighborhoodStats,
    UserAdminOut,
    UserDeleteIn,
    UsernameAvailability,
    UserPublic,
    UserSuspendIn,
    UserUpdate,
)
from app.services import audit_log as audit_log_service


def public_view(viewer: User, target: User) -> UserPublic:
    """Serializa um usuário. Qualquer usuário pode ver o perfil completo de
    qualquer bairro — o isolamento fica só no feed. Se o alvo desativou
    "Mostrar localização aproximada" e quem vê não é ele mesmo, o bairro
    não é exposto."""
    view = UserPublic.model_validate(target)
    if viewer.id != target.id and not target.show_location:
        view.neighborhood = ""
    return view


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


def get_by_username(db: Session, viewer: User, username: str) -> UserPublic:
    """Resolve um @handle → perfil público (usado ao tocar numa menção)."""
    user = user_dao.get_by_username(db, (username or "").strip().lower())
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


def community_stats(db: Session) -> CommunityStats:
    """Total de contas + fotos reais mais recentes — vitrine pública da tela de
    boas-vindas (sem login, ver `routers/auth.py::/auth/community-stats`)."""
    return CommunityStats(
        total_users=user_dao.count_all(db),
        avatar_urls=user_dao.get_avatar_samples(db),
    )


def update_me(db: Session, user: User, payload: UserUpdate) -> User:
    data = payload.model_dump(exclude_none=True)

    new_username = data.get("username")
    renamed_from = None
    if new_username and new_username != user.username:
        existing = user_dao.get_by_username(db, new_username)
        if existing and existing.id != user.id:
            raise HTTPException(status_code=409, detail="Este nome de usuário já está em uso")
        renamed_from = user.username

    updated = user_dao.update(db, user, data)
    if renamed_from:
        # Menção é texto literal no conteúdo: sem isso, todo `@antigo` já
        # publicado deixaria de resolver (mesmo caminho de services/staff.py).
        mention_dao.rewrite_handle(db, renamed_from, new_username)
    return updated


def update_avatar(db: Session, user: User, base_url: str, data_url: str) -> User:
    avatar_url = save_data_url_image(base_url, data_url, prefix=str(user.id))
    return user_dao.update(db, user, {"avatar_url": avatar_url})


def remove_avatar(db: Session, user: User) -> User:
    """Volta pro avatar padrão (inicial do nome). O arquivo antigo fica no
    disco de propósito: pode estar referenciado por conteúdo já publicado."""
    return user_dao.update(db, user, {"avatar_url": None})


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
    audit_log_service.log(db, moderator, AuditLogAction.USER_SUSPEND, target.id, detail)
    realtime_registry.wake(target.id)
    return _admin_out(target)


def admin_unsuspend(db: Session, user_id: int, moderator: User) -> UserAdminOut:
    target = user_dao.get_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    user_dao.update(
        db, target, {"is_suspended": False, "suspended_until": None, "suspension_reason": ""}
    )
    audit_log_service.log(db, moderator, AuditLogAction.USER_UNSUSPEND, target.id, "Suspensão revogada")
    return _admin_out(target)


def admin_delete(db: Session, user_id: int, payload: UserDeleteIn, moderator: User) -> None:
    """Exclui o acesso e anonimiza irreversivelmente os dados da conta.

    A linha é preservada para não quebrar autoria de conteúdo, conversas,
    denúncias e auditoria; nenhuma credencial ou dado pessoal permanece nela.
    """
    target = user_dao.get_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if target.is_moderator:
        raise HTTPException(status_code=400, detail="Contas da equipe devem ser gerenciadas na seção Equipe")
    if target.suspension_reason == "Conta excluída pela moderação":
        raise HTTPException(status_code=410, detail="Esta conta já foi excluída")
    if payload.username.strip().lower().removeprefix("@") != target.username.lower():
        raise HTTPException(status_code=400, detail="O nome de usuário digitado não corresponde à conta")

    old_username = target.username
    old_name = target.name
    anonymized_username = f"conta_excluida_{target.id}"
    mention_dao.rewrite_handle(db, old_username, anonymized_username)
    user_dao.update(
        db,
        target,
        {
            "username": anonymized_username,
            "name": "Conta excluída",
            "email": f"deleted-{target.id}-{secrets.token_hex(8)}@deleted.invalid",
            "hashed_password": hash_password(secrets.token_urlsafe(32)),
            "google_id": None,
            "bio": "",
            "avatar_url": None,
            "cover_url": None,
            "neighborhood": "",
            "city": "",
            "state": "",
            "latitude": None,
            "longitude": None,
            "verified": False,
            "email_verified": False,
            "verification_code_hash": None,
            "verification_code_expires_at": None,
            "totp_secret": None,
            "totp_enabled": False,
            "show_location": False,
            "searchable": False,
            "is_suspended": True,
            "suspended_until": None,
            "suspension_reason": "Conta excluída pela moderação",
        },
    )
    audit_log_service.log(
        db,
        moderator,
        AuditLogAction.USER_DELETE,
        target.id,
        f"Conta excluída permanentemente: {old_name} (@{old_username})",
    )
    realtime_registry.wake(target.id)

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.daos import group as group_dao
from app.daos import mute as mute_dao
from app.daos import user as user_dao
from app.models.mute import KIND_DM, KIND_GROUP
from app.models.user import User
from app.schemas.mute import MuteDuration, MuteStatusOut

_DURATIONS: dict[str, timedelta] = {
    "8h": timedelta(hours=8),
    "1d": timedelta(days=1),
    "1w": timedelta(weeks=1),
}


def resolve_until(duration: MuteDuration) -> datetime | None:
    if duration == "forever":
        return None
    delta = _DURATIONS.get(duration)
    if delta is None:
        raise HTTPException(status_code=400, detail="Duração inválida")
    return datetime.now(timezone.utc) + delta


def _status(row) -> MuteStatusOut:  # noqa: ANN001 — ConversationMute | None
    if row is None or not row.is_active:
        return MuteStatusOut(is_muted=False, muted_until=None)
    return MuteStatusOut(is_muted=True, muted_until=row.muted_until)


# ── DM ──────────────────────────────────────────────────────────────────
def get_dm_status(db: Session, user: User, other_id: int) -> MuteStatusOut:
    return _status(mute_dao.get(db, user.id, KIND_DM, other_id))


def mute_dm(db: Session, user: User, other_id: int, duration: MuteDuration) -> MuteStatusOut:
    if not user_dao.get_by_id(db, other_id):
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    row = mute_dao.upsert(db, user.id, KIND_DM, other_id, resolve_until(duration))
    return _status(row)


def unmute_dm(db: Session, user: User, other_id: int) -> MuteStatusOut:
    mute_dao.remove(db, user.id, KIND_DM, other_id)
    return MuteStatusOut(is_muted=False, muted_until=None)


# ── Grupo ──────────────────────────────────────────────────────────────
def get_group_status(db: Session, user_id: int, group_id: int) -> MuteStatusOut:
    return _status(mute_dao.get(db, user_id, KIND_GROUP, group_id))


def mute_group(db: Session, user: User, group_id: int, duration: MuteDuration) -> MuteStatusOut:
    if not group_dao.get_membership(db, group_id, user.id):
        raise HTTPException(status_code=403, detail="Você não participa deste grupo")
    row = mute_dao.upsert(db, user.id, KIND_GROUP, group_id, resolve_until(duration))
    return _status(row)


def unmute_group(db: Session, user: User, group_id: int) -> MuteStatusOut:
    mute_dao.remove(db, user.id, KIND_GROUP, group_id)
    return MuteStatusOut(is_muted=False, muted_until=None)


# ── Leitura em massa (listagens) ──────────────────────────────────────────
def dm_mute_map(db: Session, user_id: int) -> dict[int, datetime | None]:
    """other_user_id → muted_until (None = indeterminado), só ativos."""
    return {tid: row.muted_until for tid, row in mute_dao.active_map(db, user_id, KIND_DM).items()}


def group_mute_map(db: Session, user_id: int) -> dict[int, datetime | None]:
    return {
        tid: row.muted_until for tid, row in mute_dao.active_map(db, user_id, KIND_GROUP).items()
    }

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin, get_db
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.staff import (
    StaffAcceptInviteIn,
    StaffInviteIn,
    StaffInviteInfo,
    StaffOut,
    StaffUsernameIn,
)
from app.services import staff


# ── Administrador/Owner (gestão de contas de staff) ─────────────────────
def admin_list_staff(
    db: Session = Depends(get_db),
    _actor: User = Depends(get_current_admin),
) -> list[StaffOut]:
    return staff.admin_list_staff(db)


def admin_invite_staff(
    payload: StaffInviteIn,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_admin),
) -> None:
    staff.admin_invite_staff(db, payload, actor)


# ── Público (link do e-mail de convite, sem sessão) ──────────────────────
def admin_check_invite(token: str, db: Session = Depends(get_db)) -> StaffInviteInfo:
    return staff.admin_check_invite(db, token)


def admin_accept_invite(
    payload: StaffAcceptInviteIn, db: Session = Depends(get_db)
) -> TokenResponse:
    return staff.admin_accept_invite(db, payload)


def admin_rename_staff(
    user_id: int,
    payload: StaffUsernameIn,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_admin),
) -> StaffOut:
    return staff.admin_rename_staff(db, user_id, payload, actor)


def admin_suspend_staff(
    user_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_admin),
) -> StaffOut:
    return staff.admin_suspend_staff(db, user_id, actor)


def admin_unsuspend_staff(
    user_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_admin),
) -> StaffOut:
    return staff.admin_unsuspend_staff(db, user_id, actor)


def admin_delete_staff(
    user_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_admin),
) -> StaffOut:
    return staff.admin_delete_staff(db, user_id, actor)

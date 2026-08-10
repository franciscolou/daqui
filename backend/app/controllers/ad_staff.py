from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_ads_administrator, get_db
from app.models.ad_admin import AdAdmin
from app.schemas.ad_auth import TokenResponse
from app.schemas.ad_staff import (
    StaffAcceptInviteIn,
    StaffInviteIn,
    StaffInviteInfo,
    StaffOut,
    StaffUsernameIn,
)
from app.services import ad_staff as staff


# ── Administrador/Owner (gestão de contas de staff) ─────────────────────
def admin_list_staff(
    db: Session = Depends(get_db),
    _actor: AdAdmin = Depends(get_current_ads_administrator),
) -> list[StaffOut]:
    return staff.admin_list_staff(db)


def admin_invite_staff(
    payload: StaffInviteIn,
    db: Session = Depends(get_db),
    actor: AdAdmin = Depends(get_current_ads_administrator),
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
    admin_id: int,
    payload: StaffUsernameIn,
    db: Session = Depends(get_db),
    actor: AdAdmin = Depends(get_current_ads_administrator),
) -> StaffOut:
    return staff.admin_rename_staff(db, admin_id, payload, actor)


def admin_suspend_staff(
    admin_id: int,
    db: Session = Depends(get_db),
    actor: AdAdmin = Depends(get_current_ads_administrator),
) -> StaffOut:
    return staff.admin_suspend_staff(db, admin_id, actor)


def admin_unsuspend_staff(
    admin_id: int,
    db: Session = Depends(get_db),
    actor: AdAdmin = Depends(get_current_ads_administrator),
) -> StaffOut:
    return staff.admin_unsuspend_staff(db, admin_id, actor)


def admin_delete_staff(
    admin_id: int,
    db: Session = Depends(get_db),
    actor: AdAdmin = Depends(get_current_ads_administrator),
) -> StaffOut:
    return staff.admin_delete_staff(db, admin_id, actor)

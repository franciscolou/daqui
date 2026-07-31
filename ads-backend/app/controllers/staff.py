from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_administrator, get_db
from app.models.admin import AdAdmin
from app.schemas.staff import StaffCreateIn, StaffOut
from app.services import staff


# ── Administrador/Owner (gestão de contas de staff) ─────────────────────
def admin_list_staff(
    db: Session = Depends(get_db),
    _actor: AdAdmin = Depends(get_current_administrator),
) -> list[StaffOut]:
    return staff.admin_list_staff(db)


def admin_create_staff(
    payload: StaffCreateIn,
    db: Session = Depends(get_db),
    actor: AdAdmin = Depends(get_current_administrator),
) -> StaffOut:
    return staff.admin_create_staff(db, payload, actor)


def admin_suspend_staff(
    admin_id: int,
    db: Session = Depends(get_db),
    actor: AdAdmin = Depends(get_current_administrator),
) -> StaffOut:
    return staff.admin_suspend_staff(db, admin_id, actor)


def admin_unsuspend_staff(
    admin_id: int,
    db: Session = Depends(get_db),
    actor: AdAdmin = Depends(get_current_administrator),
) -> StaffOut:
    return staff.admin_unsuspend_staff(db, admin_id, actor)


def admin_delete_staff(
    admin_id: int,
    db: Session = Depends(get_db),
    actor: AdAdmin = Depends(get_current_administrator),
) -> StaffOut:
    return staff.admin_delete_staff(db, admin_id, actor)

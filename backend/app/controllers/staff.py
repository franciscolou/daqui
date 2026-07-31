from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin, get_db
from app.models.user import User
from app.schemas.staff import StaffCreateIn, StaffOut
from app.services import staff


# ── Administrador/Owner (gestão de contas de staff) ─────────────────────
def admin_list_staff(
    db: Session = Depends(get_db),
    _actor: User = Depends(get_current_admin),
) -> list[StaffOut]:
    return staff.admin_list_staff(db)


def admin_create_staff(
    payload: StaffCreateIn,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_admin),
) -> StaffOut:
    return staff.admin_create_staff(db, payload, actor)


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

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.core.staff_rank import can_manage
from app.daos import user as user_dao
from app.models.audit_log import AuditLogAction
from app.models.user import StaffRole, User
from app.schemas.staff import StaffCreateIn, StaffOut
from app.services import audit_log as audit_log_service


def _out(u: User) -> StaffOut:
    return StaffOut.model_validate(u)


def admin_list_staff(db: Session) -> list[StaffOut]:
    return [_out(u) for u in user_dao.list_staff(db)]


def admin_create_staff(db: Session, payload: StaffCreateIn, actor: User) -> StaffOut:
    if payload.role == StaffRole.OWNER:
        raise HTTPException(status_code=400, detail="Não é possível criar uma conta Owner")
    if payload.role == StaffRole.ADMINISTRADOR and actor.staff_role != StaffRole.OWNER:
        raise HTTPException(status_code=403, detail="Apenas o Owner pode criar contas Administrador")

    if user_dao.get_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="Este e-mail já está em uso")
    username = payload.username.strip().lower()
    if user_dao.get_by_username(db, username):
        raise HTTPException(status_code=400, detail="Este nome de usuário já está em uso")

    staff = user_dao.create(
        db,
        username=username,
        # User.name é NOT NULL, mas o ambiente de moderação não usa nome de
        # exibição — o username já é a única identidade exibida (ver StaffOut).
        name=username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        neighborhood="",
        city="São Paulo",
        state="SP",
        staff_role=payload.role,
        verified=True,
        email_verified=True,
    )
    audit_log_service.log(
        db, actor, AuditLogAction.STAFF_CREATE, staff.id, f"Criou conta {payload.role} para {payload.email}"
    )
    return _out(staff)


def _get_target(db: Session, actor: User, user_id: int) -> User:
    target = user_dao.get_by_id(db, user_id)
    if not target or target.staff_role is None:
        raise HTTPException(status_code=404, detail="Conta de staff não encontrada")
    if not can_manage(actor, target):
        raise HTTPException(status_code=403, detail="Não é possível gerenciar esta conta")
    return target


def admin_suspend_staff(db: Session, user_id: int, actor: User) -> StaffOut:
    target = _get_target(db, actor, user_id)
    user_dao.update(
        db, target, {"is_suspended": True, "suspended_until": None, "suspension_reason": "Conta de equipe suspensa"}
    )
    audit_log_service.log(db, actor, AuditLogAction.STAFF_SUSPEND, target.id, f"Suspendeu {target.email}")
    return _out(target)


def admin_unsuspend_staff(db: Session, user_id: int, actor: User) -> StaffOut:
    target = _get_target(db, actor, user_id)
    user_dao.update(db, target, {"is_suspended": False, "suspended_until": None, "suspension_reason": ""})
    audit_log_service.log(db, actor, AuditLogAction.STAFF_UNSUSPEND, target.id, f"Reativou {target.email}")
    return _out(target)


def admin_delete_staff(db: Session, user_id: int, actor: User) -> StaffOut:
    """"Excluir" aqui é uma suspensão permanente pela UI, não um DELETE físico:
    AuditLog.moderator_id é FK NOT NULL para users.id, então apagar a linha
    quebraria o histórico de qualquer ação que essa conta já tenha registrado.
    O cargo (staff_role) é mantido — só assim a conta continua aparecendo na
    listagem de equipe (marcada como excluída via suspension_reason)."""
    target = _get_target(db, actor, user_id)
    user_dao.update(
        db,
        target,
        {"is_suspended": True, "suspended_until": None, "suspension_reason": "Conta de equipe excluída"},
    )
    audit_log_service.log(
        db, actor, AuditLogAction.STAFF_DELETE, target.id, f"Excluiu conta {target.staff_role} de {target.email}"
    )
    return _out(target)

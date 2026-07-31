from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.core.staff_rank import can_manage
from app.daos import admin as admin_dao
from app.models.admin import AdAdmin, AdAdminRole
from app.models.audit_log import AdAuditLogAction
from app.schemas.staff import StaffCreateIn, StaffOut
from app.services import audit_log as audit_log_service


def _out(a: AdAdmin) -> StaffOut:
    return StaffOut.model_validate(a)


def admin_list_staff(db: Session) -> list[StaffOut]:
    return [_out(a) for a in admin_dao.list_all(db)]


def admin_create_staff(db: Session, payload: StaffCreateIn, actor: AdAdmin) -> StaffOut:
    if payload.role == AdAdminRole.OWNER:
        raise HTTPException(status_code=400, detail="Não é possível criar uma conta Owner")
    if payload.role == AdAdminRole.ADMINISTRADOR and actor.role != AdAdminRole.OWNER:
        raise HTTPException(status_code=403, detail="Apenas o Owner pode criar contas Administrador")

    if admin_dao.get_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="Este e-mail já está em uso")

    staff = admin_dao.create(db, payload.email, hash_password(payload.password), role=payload.role)
    audit_log_service.log(
        db, actor, AdAuditLogAction.STAFF_CREATE, staff.id, f"Criou conta {payload.role} para {payload.email}"
    )
    return _out(staff)


def _get_target(db: Session, actor: AdAdmin, admin_id: int) -> AdAdmin:
    target = admin_dao.get_by_id(db, admin_id)
    if not target:
        raise HTTPException(status_code=404, detail="Conta de staff não encontrada")
    if not can_manage(actor, target):
        raise HTTPException(status_code=403, detail="Não é possível gerenciar esta conta")
    return target


def admin_suspend_staff(db: Session, admin_id: int, actor: AdAdmin) -> StaffOut:
    target = _get_target(db, actor, admin_id)
    admin_dao.update(db, target, {"is_suspended": True})
    audit_log_service.log(db, actor, AdAuditLogAction.STAFF_SUSPEND, target.id, f"Suspendeu {target.email}")
    return _out(target)


def admin_unsuspend_staff(db: Session, admin_id: int, actor: AdAdmin) -> StaffOut:
    target = _get_target(db, actor, admin_id)
    admin_dao.update(db, target, {"is_suspended": False})
    audit_log_service.log(db, actor, AdAuditLogAction.STAFF_UNSUSPEND, target.id, f"Reativou {target.email}")
    return _out(target)


def admin_delete_staff(db: Session, admin_id: int, actor: AdAdmin) -> StaffOut:
    """"Excluir" aqui é uma suspensão permanente pela UI, não um DELETE físico
    (mantém consistência com o backend principal, onde AuditLog.moderator_id é
    FK NOT NULL — mesmo `AdCampaign.created_by_admin_id` sendo nullable aqui).
    `role` não pode virar nulo (coluna NOT NULL): a conta continua aparecendo
    na listagem, só fica permanentemente bloqueada via is_suspended."""
    target = _get_target(db, actor, admin_id)
    admin_dao.update(db, target, {"is_suspended": True})
    audit_log_service.log(
        db, actor, AdAuditLogAction.STAFF_DELETE, target.id, f"Excluiu conta {target.role} de {target.email}"
    )
    return _out(target)

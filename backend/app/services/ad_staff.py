from fastapi import HTTPException
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.ad_staff_rank import can_manage
from app.core.config import settings
from app.core.email import send_email
from app.core.security import (
    create_ads_admin_access_token,
    create_ads_staff_invite_token,
    decode_ads_staff_invite_token,
    hash_password,
)
from app.daos import ad_admin as admin_dao
from app.models.ad_admin import AdAdmin, AdAdminRole
from app.models.ad_audit_log import AdAuditLogAction
from app.schemas.ad_auth import TokenResponse
from app.schemas.ad_staff import (
    StaffAcceptInviteIn,
    StaffInviteIn,
    StaffInviteInfo,
    StaffOut,
    StaffUsernameIn,
)
from app.services import ad_audit_log as audit_log_service

_MIN_PASSWORD_LEN = 6


def _out(a: AdAdmin) -> StaffOut:
    return StaffOut.model_validate(a)


def admin_list_staff(db: Session) -> list[StaffOut]:
    return [_out(a) for a in admin_dao.list_all(db)]


def admin_invite_staff(db: Session, payload: StaffInviteIn, actor: AdAdmin) -> None:
    """Convida uma conta de staff por e-mail — quem convida só escolhe o
    e-mail (e, se for Owner, o cargo); a conta em si só existe quando o
    convidado escolhe usuário/senha em `admin_accept_invite`."""
    role = payload.role
    if role == AdAdminRole.OWNER:
        raise HTTPException(status_code=400, detail="Não é possível convidar uma conta Owner")
    if role == AdAdminRole.ADMINISTRADOR and actor.role != AdAdminRole.OWNER:
        raise HTTPException(status_code=403, detail="Apenas o Owner pode convidar contas Administrador")

    email = payload.email.strip().lower()
    if admin_dao.get_by_email(db, email):
        raise HTTPException(status_code=400, detail="Este e-mail já está em uso")

    token = create_ads_staff_invite_token(email, role.value, actor.id)
    link = f"{settings.ADS_ADMIN_URL}/?invite_token={token}"
    send_email(
        email,
        "Convite para a equipe de anúncios — Daqui",
        f"<p>Você foi convidado por {actor.email} para fazer parte da equipe de anúncios "
        f"do Daqui, como <b>{role.value}</b>. Clique no link abaixo para escolher seu nome "
        f"de usuário e senha (o convite vale por 7 dias):</p>"
        f'<p><a href="{link}">{link}</a></p>'
        f"<p>Se você não esperava este convite, ignore este e-mail.</p>",
    )
    audit_log_service.log(
        db, actor, AdAuditLogAction.STAFF_INVITE, None, f"Convidou {email} para conta {role.value}"
    )


def _decode_invite(token: str) -> dict:
    try:
        return decode_ads_staff_invite_token(token)
    except JWTError:
        raise HTTPException(
            status_code=400, detail="Convite inválido ou expirado. Peça um novo."
        ) from None


def admin_check_invite(db: Session, token: str) -> StaffInviteInfo:
    claims = _decode_invite(token)
    return StaffInviteInfo(email=claims["sub"], role=AdAdminRole(claims["role"]))


def admin_accept_invite(db: Session, payload: StaffAcceptInviteIn) -> TokenResponse:
    claims = _decode_invite(payload.token)
    email = claims["sub"]
    role = AdAdminRole(claims["role"])
    invited_by_id = int(claims["invited_by"])

    if admin_dao.get_by_email(db, email):
        raise HTTPException(status_code=400, detail="Este convite já foi utilizado.")
    if admin_dao.get_by_username(db, payload.username):
        raise HTTPException(status_code=400, detail="Este nome de usuário já está em uso")
    if len(payload.password) < _MIN_PASSWORD_LEN:
        raise HTTPException(
            status_code=400, detail=f"A senha deve ter ao menos {_MIN_PASSWORD_LEN} caracteres"
        )

    staff = admin_dao.create(
        db, email, payload.username, hash_password(payload.password), role=role
    )

    inviter = admin_dao.get_by_id(db, invited_by_id)
    inviter_desc = f"@{inviter.username}" if inviter else "um administrador"
    audit_log_service.log(
        db,
        staff,
        AdAuditLogAction.STAFF_INVITE_ACCEPTED,
        staff.id,
        f"Ativou o convite de {inviter_desc} e criou a conta @{payload.username}",
    )
    return TokenResponse(access_token=create_ads_admin_access_token(staff.id))


def _get_target(db: Session, actor: AdAdmin, admin_id: int) -> AdAdmin:
    target = admin_dao.get_by_id(db, admin_id)
    if not target:
        raise HTTPException(status_code=404, detail="Conta de staff não encontrada")
    if not can_manage(actor, target):
        raise HTTPException(status_code=403, detail="Não é possível gerenciar esta conta")
    return target


def admin_rename_staff(
    db: Session, admin_id: int, payload: StaffUsernameIn, actor: AdAdmin
) -> StaffOut:
    """Troca o username de uma conta de staff de rank inferior. Todo lugar que
    mostra o username (listagem de equipe, auditoria) sai de FK pra `ad_admins`,
    então acompanha sozinho — aqui não há conteúdo com o handle escrito no meio
    do texto, diferente do backend principal (menções)."""
    target = _get_target(db, actor, admin_id)
    new_username = payload.username
    if new_username == target.username:
        return _out(target)
    if admin_dao.get_by_username(db, new_username):
        raise HTTPException(status_code=400, detail="Este nome de usuário já está em uso")

    old_username = target.username
    admin_dao.update(db, target, {"username": new_username})
    audit_log_service.log(
        db,
        actor,
        AdAuditLogAction.STAFF_USERNAME_CHANGE,
        target.id,
        f"Renomeou @{old_username} para @{new_username}",
    )
    return _out(target)


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

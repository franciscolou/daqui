from fastapi import HTTPException
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.email import send_email
from app.core.security import (
    create_access_token,
    create_staff_invite_token,
    decode_staff_invite_token,
    hash_password,
)
from app.core.staff_rank import can_manage
from app.daos import mention as mention_dao
from app.daos import user as user_dao
from app.models.audit_log import AuditLogAction
from app.models.user import StaffRole, User
from app.schemas.auth import TokenResponse
from app.schemas.staff import (
    StaffAcceptInviteIn,
    StaffInviteIn,
    StaffInviteInfo,
    StaffOut,
    StaffUsernameIn,
)
from app.services import audit_log as audit_log_service

_MIN_PASSWORD_LEN = 6


def _out(u: User) -> StaffOut:
    return StaffOut.model_validate(u)


def admin_list_staff(db: Session) -> list[StaffOut]:
    return [_out(u) for u in user_dao.list_staff(db)]


def admin_invite_staff(db: Session, payload: StaffInviteIn, actor: User) -> None:
    """Convida uma conta de staff por e-mail — quem convida só escolhe o
    e-mail (e, se for Owner, o cargo); a conta em si só existe quando o
    convidado escolhe usuário/senha em `admin_accept_invite`."""
    role = payload.role
    if role == StaffRole.OWNER:
        raise HTTPException(status_code=400, detail="Não é possível convidar uma conta Owner")
    if role == StaffRole.ADMINISTRADOR and actor.staff_role != StaffRole.OWNER:
        raise HTTPException(status_code=403, detail="Apenas o Owner pode convidar contas Administrador")

    email = payload.email.strip().lower()
    if user_dao.get_by_email(db, email):
        raise HTTPException(status_code=400, detail="Este e-mail já está em uso")

    token = create_staff_invite_token(email, role.value, actor.id)
    link = f"{settings.MODERATOR_URL}/?invite_token={token}"
    send_email(
        email,
        "Convite para a equipe de moderação — Daqui",
        f"<p>Você foi convidado por {actor.email} para fazer parte da equipe de moderação "
        f"do Daqui, como <b>{role.value}</b>. Clique no link abaixo para escolher seu nome "
        f"de usuário e senha (o convite vale por 7 dias):</p>"
        f'<p><a href="{link}">{link}</a></p>'
        f"<p>Se você não esperava este convite, ignore este e-mail.</p>",
    )
    audit_log_service.log(
        db, actor, AuditLogAction.STAFF_INVITE, None, f"Convidou {email} para conta {role.value}"
    )


def _decode_invite(token: str) -> dict:
    try:
        return decode_staff_invite_token(token)
    except JWTError:
        raise HTTPException(
            status_code=400, detail="Convite inválido ou expirado. Peça um novo."
        ) from None


def admin_check_invite(db: Session, token: str) -> StaffInviteInfo:
    claims = _decode_invite(token)
    return StaffInviteInfo(email=claims["sub"], role=StaffRole(claims["role"]))


def admin_accept_invite(db: Session, payload: StaffAcceptInviteIn) -> TokenResponse:
    claims = _decode_invite(payload.token)
    email = claims["sub"]
    role = StaffRole(claims["role"])
    invited_by_id = int(claims["invited_by"])

    if user_dao.get_by_email(db, email):
        raise HTTPException(status_code=400, detail="Este convite já foi utilizado.")
    if user_dao.get_by_username(db, payload.username):
        raise HTTPException(status_code=400, detail="Este nome de usuário já está em uso")
    if len(payload.password) < _MIN_PASSWORD_LEN:
        raise HTTPException(
            status_code=400, detail=f"A senha deve ter ao menos {_MIN_PASSWORD_LEN} caracteres"
        )

    staff = user_dao.create(
        db,
        username=payload.username,
        # User.name é NOT NULL, mas o ambiente de moderação não usa nome de
        # exibição — o username já é a única identidade exibida (ver StaffOut).
        name=payload.username,
        email=email,
        hashed_password=hash_password(payload.password),
        neighborhood="",
        city="São Paulo",
        state="SP",
        staff_role=role,
        verified=True,
        email_verified=True,
    )

    inviter = user_dao.get_by_id(db, invited_by_id)
    inviter_desc = f"@{inviter.username}" if inviter else "um administrador"
    audit_log_service.log(
        db,
        staff,
        AuditLogAction.STAFF_INVITE_ACCEPTED,
        staff.id,
        f"Ativou o convite de {inviter_desc} e criou a conta @{payload.username}",
    )
    return TokenResponse(access_token=create_access_token(staff.id))


def _get_target(db: Session, actor: User, user_id: int) -> User:
    target = user_dao.get_by_id(db, user_id)
    if not target or target.staff_role is None:
        raise HTTPException(status_code=404, detail="Conta de staff não encontrada")
    if not can_manage(actor, target):
        raise HTTPException(status_code=403, detail="Não é possível gerenciar esta conta")
    return target


def admin_rename_staff(db: Session, user_id: int, payload: StaffUsernameIn, actor: User) -> StaffOut:
    """Troca o username de uma conta de staff de rank inferior.

    O username é a identidade exibida em todo lugar — como as menções ficam
    guardadas como texto literal no conteúdo, a troca reescreve as antigas
    (ver daos/mention.py). O resto (logs de auditoria, autoria de post…) sai
    de FK pro usuário, então acompanha sozinho.
    """
    target = _get_target(db, actor, user_id)
    new_username = payload.username
    if new_username == target.username:
        return _out(target)
    existing = user_dao.get_by_username(db, new_username)
    if existing:
        raise HTTPException(status_code=400, detail="Este nome de usuário já está em uso")

    old_username = target.username
    user_dao.update(db, target, {"username": new_username})
    mention_dao.rewrite_handle(db, old_username, new_username)
    audit_log_service.log(
        db,
        actor,
        AuditLogAction.STAFF_USERNAME_CHANGE,
        target.id,
        f"Renomeou @{old_username} para @{new_username}",
    )
    return _out(target)


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

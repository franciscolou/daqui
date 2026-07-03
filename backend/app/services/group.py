from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.daos import group as group_dao
from app.daos import user as user_dao
from app.models.group import (
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_OWNER,
    Group,
    GroupMember,
    GroupMessage,
)
from app.models.user import User
from app.schemas.group import (
    GroupConversationOut,
    GroupCreate,
    GroupDetailOut,
    GroupMemberOut,
    GroupMessageOut,
    GroupOut,
    GroupUpdate,
)


# ── Helpers de autorização ────────────────────────────────────────────
def _require_group(db: Session, group_id: int) -> Group:
    group = group_dao.get_by_id(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")
    return group


def _require_membership(db: Session, group: Group, user: User) -> GroupMember:
    member = group_dao.get_membership(db, group.id, user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Você não participa deste grupo")
    return member


def _require_manager(db: Session, group: Group, user: User) -> GroupMember:
    member = _require_membership(db, group, user)
    if member.role not in (ROLE_OWNER, ROLE_ADMIN):
        raise HTTPException(status_code=403, detail="Ação restrita a administradores")
    return member


# ── Serialização ──────────────────────────────────────────────────────
def _to_out(group: Group, my_role: str | None) -> GroupOut:
    out = GroupOut.model_validate(group)
    out.my_role = my_role
    return out


def _detail_out(db: Session, group: Group, my_role: str | None) -> GroupDetailOut:
    members = group_dao.list_members(db, group.id)
    out = GroupDetailOut.model_validate(group)
    out.my_role = my_role
    out.members = [GroupMemberOut.model_validate(m) for m in members]
    return out


def _preview_text(msg: GroupMessage | None) -> str:
    if msg is None:
        return "Grupo criado"
    name = getattr(msg.sender, "name", "") or ""
    first = name.split(" ")[0] if name else ""
    return f"{first}: {msg.content}" if first else msg.content


# ── CRUD ──────────────────────────────────────────────────────────────
def create_group(db: Session, user: User, payload: GroupCreate) -> GroupDetailOut:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Dê um nome ao grupo")

    group = group_dao.create_group(
        db,
        name=name,
        description=payload.description.strip(),
        is_open=payload.is_open,
        avatar_url=payload.avatar_url,
        owner_id=user.id,
        neighborhood=user.neighborhood,
    )

    # Adiciona membros iniciais (ignora o próprio dono, ids inexistentes/repetidos
    # e vizinhos de outro bairro — o grupo é do bairro do dono).
    for uid in dict.fromkeys(payload.member_ids):
        if uid == user.id:
            continue
        target = user_dao.get_by_id(db, uid)
        if not target or target.neighborhood != group.neighborhood:
            continue
        if group_dao.get_membership(db, group.id, uid):
            continue
        group_dao.add_member(db, group.id, uid, ROLE_MEMBER)

    db.refresh(group)
    return _detail_out(db, group, ROLE_OWNER)


def get_group(db: Session, user: User, group_id: int) -> GroupDetailOut:
    group = _require_group(db, group_id)
    member = group_dao.get_membership(db, group.id, user.id)
    # Grupo fechado só é visível para membros.
    if member is None and not group.is_open:
        raise HTTPException(status_code=403, detail="Grupo fechado")
    return _detail_out(db, group, member.role if member else None)


def update_group(
    db: Session, user: User, group_id: int, payload: GroupUpdate
) -> GroupDetailOut:
    group = _require_group(db, group_id)
    member = _require_manager(db, group, user)

    data: dict = {}
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Nome inválido")
        data["name"] = name
    if payload.description is not None:
        data["description"] = payload.description.strip()
    if payload.is_open is not None:
        data["is_open"] = payload.is_open
    if payload.avatar_url is not None:
        data["avatar_url"] = payload.avatar_url or None

    if data:
        group = group_dao.update_group(db, group, data)
    return _detail_out(db, group, member.role)


def delete_group(db: Session, user: User, group_id: int) -> None:
    group = _require_group(db, group_id)
    if group.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Apenas o dono pode excluir o grupo")
    group_dao.delete_group(db, group)


# ── Descoberta / conversas ────────────────────────────────────────────
def list_conversations(db: Session, user: User) -> list[GroupConversationOut]:
    result: list[GroupConversationOut] = []
    for group in group_dao.list_user_groups(db, user.id):
        member = group_dao.get_membership(db, group.id, user.id)
        last = group_dao.last_message(db, group.id)
        unread = group_dao.count_unread(
            db, group.id, user.id, member.last_read_message_id if member else None
        )
        result.append(
            GroupConversationOut(
                group=_to_out(group, member.role if member else None),
                last_message=_preview_text(last),
                last_message_at=last.created_at if last else group.created_at,
                unread_count=unread,
            )
        )
    result.sort(key=lambda c: c.last_message_at, reverse=True)
    return result


def discover(db: Session, user: User, query: str) -> list[GroupOut]:
    groups = group_dao.discover_open(db, query, user.id, user.neighborhood)
    return [_to_out(g, None) for g in groups]


# ── Membros ───────────────────────────────────────────────────────────
def join(db: Session, user: User, group_id: int) -> GroupDetailOut:
    group = _require_group(db, group_id)
    if not group.is_open:
        raise HTTPException(status_code=403, detail="Grupo fechado: entrada só por convite")
    if user.neighborhood != group.neighborhood:
        raise HTTPException(
            status_code=403, detail="Este grupo é de outro bairro"
        )
    if group_dao.get_membership(db, group.id, user.id):
        return _detail_out(db, group, group_dao.get_membership(db, group.id, user.id).role)
    group_dao.add_member(db, group.id, user.id, ROLE_MEMBER)
    return _detail_out(db, group, ROLE_MEMBER)


def leave(db: Session, user: User, group_id: int) -> None:
    group = _require_group(db, group_id)
    member = _require_membership(db, group, user)
    if member.role == ROLE_OWNER:
        raise HTTPException(
            status_code=400,
            detail="O dono não pode sair; transfira ou exclua o grupo",
        )
    group_dao.remove_member(db, member)


def add_member(db: Session, user: User, group_id: int, target_id: int) -> GroupDetailOut:
    group = _require_group(db, group_id)
    manager = _require_manager(db, group, user)
    target = user_dao.get_by_id(db, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if target.neighborhood != group.neighborhood:
        raise HTTPException(
            status_code=400, detail="Só vizinhos do bairro do grupo podem entrar"
        )
    if group_dao.get_membership(db, group.id, target_id):
        raise HTTPException(status_code=400, detail="Usuário já é membro")
    group_dao.add_member(db, group.id, target_id, ROLE_MEMBER)
    return _detail_out(db, group, manager.role)


def remove_member(db: Session, user: User, group_id: int, target_id: int) -> GroupDetailOut:
    group = _require_group(db, group_id)
    manager = _require_manager(db, group, user)
    target = group_dao.get_membership(db, group.id, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    if target.role == ROLE_OWNER:
        raise HTTPException(status_code=400, detail="Não é possível remover o dono")
    # Admin não pode remover outro admin; só o dono pode.
    if target.role == ROLE_ADMIN and manager.role != ROLE_OWNER:
        raise HTTPException(status_code=403, detail="Só o dono pode remover um administrador")
    group_dao.remove_member(db, target)
    return _detail_out(db, group, manager.role)


def set_admin(
    db: Session, user: User, group_id: int, target_id: int, make_admin: bool
) -> GroupDetailOut:
    group = _require_group(db, group_id)
    if group.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Apenas o dono nomeia administradores")
    target = group_dao.get_membership(db, group.id, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    if target.role == ROLE_OWNER:
        raise HTTPException(status_code=400, detail="O dono já administra o grupo")
    group_dao.set_role(db, target, ROLE_ADMIN if make_admin else ROLE_MEMBER)
    return _detail_out(db, group, ROLE_OWNER)


# ── Mensagens ─────────────────────────────────────────────────────────
def get_thread(db: Session, user: User, group_id: int) -> list[GroupMessageOut]:
    group = _require_group(db, group_id)
    member = _require_membership(db, group, user)
    messages = group_dao.get_messages(db, group.id)
    if messages:
        group_dao.mark_read(db, member, messages[-1].id)
    return [GroupMessageOut.model_validate(m) for m in messages]


def send_message(
    db: Session, user: User, group_id: int, content: str
) -> GroupMessageOut:
    group = _require_group(db, group_id)
    member = _require_membership(db, group, user)
    content = content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Mensagem vazia")
    msg = group_dao.create_message(db, group.id, user.id, content)
    group_dao.mark_read(db, member, msg.id)
    return GroupMessageOut.model_validate(msg)

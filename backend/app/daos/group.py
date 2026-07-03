from sqlalchemy import case, desc, func
from sqlalchemy.orm import Session

from app.models.group import (
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_OWNER,
    Group,
    GroupMember,
    GroupMessage,
)

# Ordena membros: dono, depois admins, depois membros comuns.
_ROLE_RANK = case(
    (GroupMember.role == ROLE_OWNER, 0),
    (GroupMember.role == ROLE_ADMIN, 1),
    else_=2,
)


# ── Grupos ────────────────────────────────────────────────────────────
def create_group(
    db: Session,
    *,
    name: str,
    description: str,
    is_open: bool,
    avatar_url: str | None,
    owner_id: int,
    neighborhood: str,
) -> Group:
    group = Group(
        name=name,
        description=description,
        is_open=is_open,
        avatar_url=avatar_url,
        owner_id=owner_id,
        neighborhood=neighborhood,
        members_count=0,
    )
    db.add(group)
    db.flush()  # garante group.id antes de inserir o dono como membro
    db.add(GroupMember(group_id=group.id, user_id=owner_id, role=ROLE_OWNER))
    group.members_count = 1
    db.commit()
    db.refresh(group)
    return group


def get_by_id(db: Session, group_id: int) -> Group | None:
    return db.get(Group, group_id)


def update_group(db: Session, group: Group, data: dict) -> Group:
    for field, value in data.items():
        setattr(group, field, value)
    db.commit()
    db.refresh(group)
    return group


def delete_group(db: Session, group: Group) -> None:
    db.query(GroupMessage).filter(GroupMessage.group_id == group.id).delete()
    db.delete(group)  # cascade remove os membros
    db.commit()


def list_user_groups(db: Session, user_id: int) -> list[Group]:
    return (
        db.query(Group)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .filter(GroupMember.user_id == user_id)
        .all()
    )


def discover_open(
    db: Session, query: str, user_id: int, neighborhood: str, limit: int = 30
) -> list[Group]:
    # Grupos abertos do bairro do usuário, que casam com a busca e dos quais ele
    # ainda não participa (só é possível entrar em grupos do próprio bairro).
    member_group_ids = db.query(GroupMember.group_id).filter(
        GroupMember.user_id == user_id
    )
    q = db.query(Group).filter(
        Group.is_open.is_(True),
        Group.neighborhood == neighborhood,
        Group.id.notin_(member_group_ids),
    )
    query = query.strip()
    if query:
        q = q.filter(Group.name.ilike(f"%{query}%"))
    return q.order_by(desc(Group.members_count)).limit(limit).all()


# ── Membros ───────────────────────────────────────────────────────────
def get_membership(db: Session, group_id: int, user_id: int) -> GroupMember | None:
    return (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
        .first()
    )


def list_members(db: Session, group_id: int) -> list[GroupMember]:
    return (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group_id)
        .order_by(_ROLE_RANK, GroupMember.joined_at)
        .all()
    )


def add_member(db: Session, group_id: int, user_id: int, role: str = ROLE_MEMBER) -> GroupMember:
    member = GroupMember(group_id=group_id, user_id=user_id, role=role)
    db.add(member)
    group = db.get(Group, group_id)
    if group:
        group.members_count += 1
    db.commit()
    db.refresh(member)
    return member


def remove_member(db: Session, member: GroupMember) -> None:
    group = db.get(Group, member.group_id)
    db.delete(member)
    if group:
        group.members_count = max(0, group.members_count - 1)
    db.commit()


def set_role(db: Session, member: GroupMember, role: str) -> GroupMember:
    member.role = role
    db.commit()
    db.refresh(member)
    return member


# ── Mensagens ─────────────────────────────────────────────────────────
def create_message(db: Session, group_id: int, sender_id: int, content: str) -> GroupMessage:
    msg = GroupMessage(group_id=group_id, sender_id=sender_id, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def get_messages(db: Session, group_id: int) -> list[GroupMessage]:
    return (
        db.query(GroupMessage)
        .filter(GroupMessage.group_id == group_id)
        .order_by(GroupMessage.created_at)
        .all()
    )


def last_message(db: Session, group_id: int) -> GroupMessage | None:
    return (
        db.query(GroupMessage)
        .filter(GroupMessage.group_id == group_id)
        .order_by(desc(GroupMessage.id))
        .first()
    )


def count_unread(db: Session, group_id: int, user_id: int, last_read_id: int | None) -> int:
    return (
        db.query(func.count(GroupMessage.id))
        .filter(
            GroupMessage.group_id == group_id,
            GroupMessage.sender_id != user_id,
            GroupMessage.id > (last_read_id or 0),
        )
        .scalar()
        or 0
    )


def mark_read(db: Session, member: GroupMember, last_id: int) -> None:
    if (member.last_read_message_id or 0) < last_id:
        member.last_read_message_id = last_id
        db.commit()

from fastapi import Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.group import (
    GroupAvatarUpdate,
    GroupConversationOut,
    GroupCreate,
    GroupDetailOut,
    GroupJoinRequestOut,
    GroupMemberAdd,
    GroupMessageCreate,
    GroupMessageOut,
    GroupOut,
    GroupUpdate,
)
from app.services import group as group_service


def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupDetailOut:
    return group_service.create_group(db, current_user, payload)


def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GroupConversationOut]:
    return group_service.list_conversations(db, current_user)


def discover(
    q: str = Query("", description="Termo de busca"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GroupOut]:
    return group_service.discover(db, current_user, q)


def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupDetailOut:
    return group_service.get_group(db, current_user, group_id)


def update_group(
    group_id: int,
    payload: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupDetailOut:
    return group_service.update_group(db, current_user, group_id, payload)


def set_group_avatar(
    group_id: int,
    payload: GroupAvatarUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupDetailOut:
    return group_service.set_avatar(
        db, current_user, group_id, str(request.base_url), payload.image
    )


def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    group_service.delete_group(db, current_user, group_id)


def join_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupDetailOut:
    return group_service.join(db, current_user, group_id)


def leave_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    group_service.leave(db, current_user, group_id)


def cancel_join_request(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    group_service.cancel_join_request(db, current_user, group_id)


def list_join_requests(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GroupJoinRequestOut]:
    return group_service.list_join_requests(db, current_user, group_id)


def approve_join_request(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupDetailOut:
    return group_service.approve_join_request(db, current_user, group_id, user_id)


def reject_join_request(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupDetailOut:
    return group_service.reject_join_request(db, current_user, group_id, user_id)


def add_member(
    group_id: int,
    payload: GroupMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupDetailOut:
    return group_service.add_member(db, current_user, group_id, payload.user_id)


def remove_member(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupDetailOut:
    return group_service.remove_member(db, current_user, group_id, user_id)


def promote_admin(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupDetailOut:
    return group_service.set_admin(db, current_user, group_id, user_id, make_admin=True)


def demote_admin(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupDetailOut:
    return group_service.set_admin(db, current_user, group_id, user_id, make_admin=False)


def get_thread(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GroupMessageOut]:
    return group_service.get_thread(db, current_user, group_id)


def send_message(
    group_id: int,
    payload: GroupMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupMessageOut:
    return group_service.send_message(
        db, current_user, group_id, payload.content, payload.reply_to_id
    )

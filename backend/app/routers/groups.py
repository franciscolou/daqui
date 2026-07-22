from fastapi import APIRouter

from app.controllers import group
from app.schemas.group import (
    GroupConversationOut,
    GroupDetailOut,
    GroupJoinRequestOut,
    GroupMessageOut,
    GroupOut,
)
from app.schemas.mute import MuteStatusOut

router = APIRouter(prefix="/groups", tags=["groups"])

# Rotas estáticas antes das dinâmicas /{group_id} (senão caem no id).
router.post("/", response_model=GroupDetailOut, status_code=201)(group.create_group)
router.get("/conversations", response_model=list[GroupConversationOut])(group.list_conversations)
router.get("/discover", response_model=list[GroupOut])(group.discover)

router.get("/{group_id}", response_model=GroupDetailOut)(group.get_group)
router.patch("/{group_id}", response_model=GroupDetailOut)(group.update_group)
router.post("/{group_id}/avatar", response_model=GroupDetailOut)(group.set_group_avatar)
router.delete("/{group_id}", status_code=204)(group.delete_group)

router.post("/{group_id}/join", response_model=GroupDetailOut)(group.join_group)
router.delete("/{group_id}/join", status_code=204)(group.cancel_join_request)
router.post("/{group_id}/leave", status_code=204)(group.leave_group)

router.get("/{group_id}/join-requests", response_model=list[GroupJoinRequestOut])(group.list_join_requests)
router.post("/{group_id}/join-requests/{user_id}/approve", response_model=GroupDetailOut)(group.approve_join_request)
router.post("/{group_id}/join-requests/{user_id}/reject", response_model=GroupDetailOut)(group.reject_join_request)

router.post("/{group_id}/members", response_model=GroupDetailOut)(group.add_member)
router.delete("/{group_id}/members/{user_id}", response_model=GroupDetailOut)(group.remove_member)
router.post("/{group_id}/members/{user_id}/admin", response_model=GroupDetailOut)(group.promote_admin)
router.delete("/{group_id}/members/{user_id}/admin", response_model=GroupDetailOut)(group.demote_admin)

router.get("/{group_id}/messages", response_model=list[GroupMessageOut])(group.get_thread)
router.post("/{group_id}/messages", response_model=GroupMessageOut, status_code=201)(group.send_message)

router.post("/{group_id}/mute", response_model=MuteStatusOut)(group.mute_group)
router.delete("/{group_id}/mute", response_model=MuteStatusOut)(group.unmute_group)

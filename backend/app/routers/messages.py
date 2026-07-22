from fastapi import APIRouter

from app.controllers import message
from app.schemas.message import (
    ConversationOut,
    MessageOut,
    MessageSearchOut,
    UnreadCountOut,
)
from app.schemas.mute import MuteStatusOut

router = APIRouter(prefix="/messages", tags=["messages"])

# Rotas estáticas antes da dinâmica /{user_id} (senão "search"/"conversations" caem no id).
router.get( "/conversations",  response_model=list[ConversationOut])(message.list_conversations)
router.get( "/search",         response_model=list[MessageSearchOut])(message.search_messages)
router.get( "/unread-count",   response_model=UnreadCountOut)(message.get_unread_count)
router.post("/typing",         status_code=204)(message.ping_typing)
router.get( "/{user_id}",      response_model=list[MessageOut])(message.get_thread)
router.post("/",               response_model=MessageOut, status_code=201)(message.send_message)

# Silenciamento de notificações da conversa (2 segmentos — não colide com /{user_id}).
router.get(   "/{user_id}/mute", response_model=MuteStatusOut)(message.get_mute)
router.post(  "/{user_id}/mute", response_model=MuteStatusOut)(message.mute_conversation)
router.delete("/{user_id}/mute", response_model=MuteStatusOut)(message.unmute_conversation)

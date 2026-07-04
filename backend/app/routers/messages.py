from fastapi import APIRouter

from app.controllers import message
from app.schemas.message import (
    ConversationOut,
    MessageOut,
    MessageSearchOut,
    UnreadCountOut,
)

router = APIRouter(prefix="/messages", tags=["messages"])

# Rotas estáticas antes da dinâmica /{user_id} (senão "search"/"conversations" caem no id).
router.get( "/conversations",  response_model=list[ConversationOut])(message.list_conversations)
router.get( "/search",         response_model=list[MessageSearchOut])(message.search_messages)
router.get( "/unread-count",   response_model=UnreadCountOut)(message.get_unread_count)
router.get( "/{user_id}",      response_model=list[MessageOut])(message.get_thread)
router.post("/",               response_model=MessageOut, status_code=201)(message.send_message)

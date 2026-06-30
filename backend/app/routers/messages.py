from fastapi import APIRouter

from app.controllers import message
from app.schemas.message import ConversationOut, MessageOut

router = APIRouter(prefix="/messages", tags=["messages"])

router.get( "/conversations", response_model=list[ConversationOut])(message.list_conversations)
router.get( "/{user_id}",     response_model=list[MessageOut])(message.get_thread)
router.post("/",              response_model=MessageOut, status_code=201)(message.send_message)

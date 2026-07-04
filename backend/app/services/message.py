from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.daos import group as group_dao
from app.daos import message as message_dao
from app.daos import post as post_dao
from app.daos import user as user_dao
from app.models.message import Message
from app.models.user import User
from app.schemas.message import ConversationOut, MessageCreate, MessageSearchOut
from app.schemas.user import UserPublic


def _preview_text(msg: Message) -> str:
    """Texto da prévia na lista de conversas/busca (mensagem só com post vira rótulo)."""
    if msg.content:
        return msg.content
    if msg.shared_post_id is not None:
        title = getattr(msg.shared_post, "title", None)
        return f"📎 {title}" if title else "📎 Post compartilhado"
    return ""


def list_conversations(db: Session, user: User) -> list[ConversationOut]:
    last_messages = message_dao.get_last_per_conversation(db, user.id)
    result = []
    for msg in last_messages:
        other_id = msg.receiver_id if msg.sender_id == user.id else msg.sender_id
        other = user_dao.get_by_id(db, other_id)
        if not other:
            continue
        unread = message_dao.count_unread(db, from_user_id=other_id, to_user_id=user.id)
        result.append(
            ConversationOut(
                user=UserPublic.model_validate(other),
                last_message=_preview_text(msg),
                last_message_at=msg.created_at,
                unread_count=unread,
            )
        )
    return result


def search_messages(db: Session, user: User, query: str) -> list[MessageSearchOut]:
    query = query.strip()
    if not query:
        return []
    results = []
    for m in message_dao.search(db, user.id, query):
        from_me = m.sender_id == user.id
        other_id = m.receiver_id if from_me else m.sender_id
        other = user_dao.get_by_id(db, other_id)
        if not other:
            continue
        results.append(
            MessageSearchOut(
                id=m.id,
                content=_preview_text(m),
                created_at=m.created_at,
                from_me=from_me,
                conversation_user=UserPublic.model_validate(other),
            )
        )
    return results


def unread_count(db: Session, user: User) -> int:
    """Total de mensagens não lidas — diretas + grupos — usado no selo de 'Mensagens'."""
    return message_dao.count_unread_total(db, user.id) + group_dao.count_unread_for_user(
        db, user.id
    )


def get_thread(db: Session, user: User, other_id: int) -> list[Message]:
    messages = message_dao.get_thread(db, user.id, other_id)
    message_dao.mark_thread_read(db, messages, receiver_id=user.id)
    return messages


def send(db: Session, user: User, payload: MessageCreate) -> Message:
    receiver = user_dao.get_by_id(db, payload.receiver_id)
    if not receiver:
        raise HTTPException(status_code=404, detail="Destinatário não encontrado")

    content = payload.content.strip()
    if not content and payload.shared_post_id is None:
        raise HTTPException(status_code=400, detail="Mensagem vazia")

    if payload.shared_post_id is not None:
        shared_post = post_dao.get_by_id(db, payload.shared_post_id)
        if not shared_post:
            raise HTTPException(status_code=404, detail="Post não encontrado")
        # Isolamento por bairro: não deixa encaminhar post para morador de outro bairro.
        if shared_post.neighborhood != receiver.neighborhood:
            raise HTTPException(
                status_code=403,
                detail="Este post não pode ser encaminhado para um morador de outro bairro",
            )

    return message_dao.create(
        db, user.id, payload.receiver_id, content, payload.shared_post_id
    )

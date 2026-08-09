from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core import typing_registry
from app.core.uploads import save_upload_media
from app.daos import comment as comment_dao
from app.daos import group as group_dao
from app.daos import message as message_dao
from app.daos import post as post_dao
from app.daos import user as user_dao
from app.models.message import Message
from app.models.mute import MuteKind
from app.models.user import User
from app.schemas.attachment import AttachmentItem, MediaGalleryItem
from app.schemas.message import (
    ConversationOut,
    MessageCreate,
    MessageSearchOut,
    TypingPing,
)
from app.schemas.user import UserPublic
from app.services import mutes as mute_service
from app.services import push as push_service


def upload_media(user: User, base_url: str, file: UploadFile) -> AttachmentItem:
    url, media_type = save_upload_media(base_url, file, prefix=f"message_{user.id}")
    return AttachmentItem(url=url, type=media_type)


def list_media(db: Session, user: User, other_id: int) -> list[MediaGalleryItem]:
    """Galeria de fotos/vídeos já trocados na conversa — usada pela tela de
    info (ver components/MediaGalleryView.tsx no frontend)."""
    messages = message_dao.get_media_thread(db, user.id, other_id)
    return [
        MediaGalleryItem(id=m.id, url=m.media_url, type=m.media_type, created_at=m.created_at)
        for m in messages
    ]


def _preview_text(msg: Message) -> str:
    """Texto da prévia na lista de conversas/busca (mensagem só com post vira rótulo)."""
    if msg.content:
        return msg.content
    if msg.media_url is not None:
        return "🎥 Vídeo" if msg.media_type == "video" else "📷 Foto"
    if msg.shared_post_id is not None:
        title = getattr(msg.shared_post, "title", None)
        return f"📎 {title}" if title else "📎 Post compartilhado"
    if msg.shared_comment_id is not None:
        return "💬 Comentário compartilhado"
    if msg.shared_ad_id is not None:
        return "📢 Anúncio compartilhado"
    return ""


def list_conversations(db: Session, user: User) -> list[ConversationOut]:
    last_messages = message_dao.get_last_per_conversation(db, user.id)
    muted = mute_service.dm_mute_map(db, user.id)
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
                is_muted=other_id in muted,
                muted_until=muted.get(other_id),
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
    """Total de mensagens não lidas — diretas + grupos — usado no selo de
    'Mensagens'. Silenciar uma conversa/grupo não tira ela da contagem (só
    impede o push de chegar, ver `services/push.py`)."""
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
    if (
        not content
        and payload.media_url is None
        and payload.shared_post_id is None
        and payload.shared_comment_id is None
        and payload.shared_ad_id is None
    ):
        raise HTTPException(status_code=400, detail="Mensagem vazia")

    if payload.shared_post_id is not None:
        shared_post = post_dao.get_by_id(db, payload.shared_post_id)
        if not shared_post:
            raise HTTPException(status_code=404, detail="Post não encontrado")

    if payload.shared_comment_id is not None:
        shared_comment = comment_dao.get_by_id(db, payload.shared_comment_id)
        if not shared_comment:
            raise HTTPException(status_code=404, detail="Comentário não encontrado")

    # shared_ad_id não é validado aqui: o anúncio vive no ads-backend, um
    # serviço separado sem cliente HTTP entre os dois (mesmo tratamento de
    # confiança que AdCreative.linked_user_id já dá a um id deste backend).

    if payload.reply_to_id is not None:
        replied = message_dao.get_by_id(db, payload.reply_to_id)
        conversation_ids = {user.id, payload.receiver_id}
        if not replied or {replied.sender_id, replied.receiver_id} != conversation_ids:
            raise HTTPException(status_code=404, detail="Mensagem respondida não encontrada")

    msg = message_dao.create(
        db,
        user.id,
        payload.receiver_id,
        content,
        payload.shared_post_id,
        payload.reply_to_id,
        shared_comment_id=payload.shared_comment_id,
        shared_ad_id=payload.shared_ad_id,
        media_url=payload.media_url,
        media_type=payload.media_type.value if payload.media_type else None,
    )
    if receiver.notify_messages and not mute_service.get_dm_status(db, receiver, user.id).is_muted:
        push_service.notify_user(
            db,
            receiver.id,
            user.name,
            _preview_text(msg),
            # `username` é o que o app usa pra montar o deep link
            # `/messages/{username}` sem expor o id sequencial (ver lib/push.ts).
            data={"type": "dm", "userId": user.id, "username": user.username},
        )
    return msg


def ping_typing(db: Session, user: User, payload: TypingPing) -> None:
    """Avisa que `user` está digitando — lido pelo polling do websocket
    (ver `routers/ws.py`) e repassado a quem está na mesma conversa."""
    if payload.target_type == MuteKind.DM:
        typing_registry.set_dm_typing(user.id, payload.target_id)
    else:
        member = group_dao.get_membership(db, payload.target_id, user.id)
        if not member:
            raise HTTPException(status_code=403, detail="Sem permissão")
        typing_registry.set_group_typing(payload.target_id, user.id)

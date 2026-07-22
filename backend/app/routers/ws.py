import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError

from app.core import realtime_registry, typing_registry
from app.core.deps import suspension_message
from app.core.security import decode_token
from app.daos import group as group_dao
from app.daos import message as message_dao
from app.daos import notification as notification_dao
from app.database import SessionLocal
from app.models.user import User
from app.services import message as message_service

router = APIRouter(tags=["realtime"])

# Sem infra de pub/sub: cada conexão faz polling periódico no banco e envia só
# o que mudou desde o último ciclo. Suficiente para a escala do app (SQLite,
# um processo uvicorn) e evita ter que instrumentar cada ponto que cria
# mensagem/notificação para publicar eventos. Exceções: notificação nova e
# suspensão de conta chamam `realtime_registry.wake()`, que interrompe a
# espera na hora em vez de esperar o próximo tick (ver core/realtime_registry.py).
POLL_INTERVAL_SECONDS = 2.0


def _authenticate(token: str) -> User | None:
    try:
        user_id = int(decode_token(token))
    except (JWTError, ValueError):
        return None
    db = SessionLocal()
    try:
        return db.get(User, user_id)
    finally:
        db.close()


@router.websocket("/ws")
async def realtime(websocket: WebSocket, token: str):
    user = _authenticate(token)
    if not user:
        await websocket.close(code=4401)
        return

    await websocket.accept()
    user_id = user.id
    last_check = datetime.now(timezone.utc)
    wake_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    realtime_registry.register(user_id, wake_event, loop)

    try:
        while True:
            try:
                await asyncio.wait_for(wake_event.wait(), timeout=POLL_INTERVAL_SECONDS)
            except asyncio.TimeoutError:
                pass
            wake_event.clear()

            now = datetime.now(timezone.utc)
            db = SessionLocal()
            try:
                current = db.get(User, user_id)
                if current is None or current.is_currently_suspended:
                    await websocket.send_json(
                        {
                            "forced_logout": True,
                            "reason": suspension_message(current) if current else None,
                        }
                    )
                    await websocket.close(code=4403)
                    return

                new_messages = message_dao.new_received_since(db, user_id, last_check)
                group_ids = [g.id for g in group_dao.list_user_groups(db, user_id)]
                new_group_messages = group_dao.new_messages_since(
                    db, group_ids, user_id, last_check
                )
                new_notifications = notification_dao.new_since(db, user_id, last_check)
                unread_messages = message_service.unread_count(db, current)
                unread_notifications = notification_dao.count_unread(db, user_id)
            finally:
                db.close()
            last_check = now

            # "Digitando": lê o registro em memória (ver core/typing_registry) —
            # não bate no banco, é só um dict com timestamps recentes.
            typing_dm = typing_registry.typing_to(user_id)
            typing_groups = {
                gid: senders
                for gid in group_ids
                if (senders := typing_registry.typing_in_group(gid, user_id))
            }

            await websocket.send_json(
                {
                    "unread_messages": unread_messages,
                    "unread_notifications": unread_notifications,
                    "new_message_senders": sorted({m.sender_id for m in new_messages}),
                    "new_group_message_groups": sorted(
                        {m.group_id for m in new_group_messages}
                    ),
                    "has_new_notification": len(new_notifications) > 0,
                    "typing_dm": typing_dm,
                    "typing_groups": typing_groups,
                }
            )
    except (WebSocketDisconnect, RuntimeError):
        return
    finally:
        realtime_registry.unregister(user_id, wake_event, loop)

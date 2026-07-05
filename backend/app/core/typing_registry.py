"""Registro em memória de quem está digitando pra quem.

Segue a mesma filosofia do `routers/ws.py`: sem infra de pub/sub, um único
processo uvicorn. O cliente avisa via POST (`/messages/typing`) sempre que o
usuário digita (com debounce no app); o polling do websocket lê esse estado
a cada ciclo e informa aos outros participantes da conversa. Uma entrada
"expira" sozinha após `TTL_SECONDS` sem novo aviso — não precisa de limpeza
explícita, só filtramos pela idade na leitura.
"""

from datetime import datetime, timezone

TTL_SECONDS = 4.0

# (remetente, destinatário) -> quando foi o último aviso de "digitando"
_dm_typing: dict[tuple[int, int], datetime] = {}
# (grupo, remetente) -> quando foi o último aviso de "digitando"
_group_typing: dict[tuple[int, int], datetime] = {}


def _fresh(ts: datetime) -> bool:
    return (datetime.now(timezone.utc) - ts).total_seconds() < TTL_SECONDS


def set_dm_typing(from_id: int, to_id: int) -> None:
    _dm_typing[(from_id, to_id)] = datetime.now(timezone.utc)


def set_group_typing(group_id: int, from_id: int) -> None:
    _group_typing[(group_id, from_id)] = datetime.now(timezone.utc)


def typing_to(user_id: int) -> list[int]:
    """Quem está digitando para `user_id` agora, numa DM."""
    return [
        sender_id
        for (sender_id, to_id), ts in _dm_typing.items()
        if to_id == user_id and _fresh(ts)
    ]


def typing_in_group(group_id: int, exclude_user_id: int) -> list[int]:
    """Quem está digitando no grupo `group_id` agora (exceto o próprio usuário)."""
    return [
        sender_id
        for (gid, sender_id), ts in _group_typing.items()
        if gid == group_id and sender_id != exclude_user_id and _fresh(ts)
    ]

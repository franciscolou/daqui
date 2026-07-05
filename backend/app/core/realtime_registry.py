"""Registro em memória das conexões WS abertas, para acordá-las fora do ciclo de polling.

Mesma filosofia do `typing_registry`: sem infra de pub/sub externo, um único
processo uvicorn. O loop de `routers/ws.py` dorme até `POLL_INTERVAL_SECONDS`
ou até `wake(user_id)` ser chamado — o que vier primeiro — e então roda o
ciclo de leitura mais cedo (ex.: notificação nova, conta suspensa). `wake`
costuma ser chamado a partir de uma thread de worker (services síncronos
rodam em threadpool), por isso o registro é protegido por lock e usa
`call_soon_threadsafe` para sinalizar o `asyncio.Event`, que só pode ser
setado com segurança a partir do próprio event loop da conexão.
"""

import asyncio
import threading

_lock = threading.Lock()
_connections: dict[int, set[tuple[asyncio.Event, asyncio.AbstractEventLoop]]] = {}


def register(user_id: int, event: asyncio.Event, loop: asyncio.AbstractEventLoop) -> None:
    with _lock:
        _connections.setdefault(user_id, set()).add((event, loop))


def unregister(user_id: int, event: asyncio.Event, loop: asyncio.AbstractEventLoop) -> None:
    with _lock:
        conns = _connections.get(user_id)
        if not conns:
            return
        conns.discard((event, loop))
        if not conns:
            del _connections[user_id]


def wake(user_id: int) -> None:
    """Acorda imediatamente todas as conexões WS abertas desse usuário."""
    with _lock:
        conns = list(_connections.get(user_id, ()))
    for event, loop in conns:
        loop.call_soon_threadsafe(event.set)

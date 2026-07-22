"""Menções (@usuario) em posts e comentários.

Uma única fonte de verdade pra: extrair os @handles de um texto e notificar
os usuários mencionados. O texto continua guardado como está (com o `@handle`
literal) — o frontend resolve o link ao renderizar. Aqui só disparamos as
notificações de menção (ver `models/notification.py::TYPE_MENTION`).
"""

import re

from sqlalchemy.orm import Session

from app.daos import user as user_dao
from app.models.notification import TYPE_MENTION
from app.models.user import User
from app.services import notification as notification_service

# @handle: letra/dígito/._ (mesmo conjunto aceito no cadastro de username).
# Exige uma borda antes do @ pra não pegar e-mails (ex.: "a@b").
MENTION_RE = re.compile(r"(?:^|[^\w@])@([a-zA-Z0-9_.]{2,30})")

# Quanto do texto guardamos como "trecho" da notificação.
_PREVIEW_MAX = 200


def extract_usernames(text: str) -> list[str]:
    """Handles únicos (minúsculos, sem @) na ordem de aparição."""
    seen: set[str] = set()
    out: list[str] = []
    for m in MENTION_RE.finditer(text or ""):
        handle = m.group(1).lower()
        if handle not in seen:
            seen.add(handle)
            out.append(handle)
    return out


def notify_mentions(
    db: Session, actor: User, text: str, post_id: int, target_text: str
) -> None:
    """Cria uma notificação de menção pra cada usuário citado em `text`
    (menos o próprio autor), e acorda os websockets deles. Handles que não
    correspondem a nenhuma conta são simplesmente ignorados."""
    handles = extract_usernames(text)
    if not handles:
        return
    for handle in handles:
        target = user_dao.get_by_username(db, handle)
        if not target or target.id == actor.id:
            continue
        notification_service.notify(
            db,
            user_id=target.id,
            type_=TYPE_MENTION,
            content="mencionou você",
            target_text=(target_text or "")[:_PREVIEW_MAX],
            post_id=post_id,
            actor_id=actor.id,
            push_title=f"{actor.name} mencionou você",
            push_body=(target_text or "")[:_PREVIEW_MAX] or "mencionou você",
        )

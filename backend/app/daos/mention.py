"""Reescrita de `@handle` em conteúdo já publicado.

Menção é guardada como texto literal (`services/mentions.py` só resolve o
handle na hora de notificar; o frontend resolve o link ao renderizar), então
trocar o username de uma conta deixaria toda menção antiga apontando pra um
handle inexistente. Esta é a única camada que varre esse conteúdo.
"""

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.username import mention_pattern
from app.models.comment import Comment
from app.models.group import GroupMessage
from app.models.message import Message
from app.models.post import Post

# Onde um `@handle` pode ter sido escrito: (modelo, campos de texto livre).
_MENTION_FIELDS: list[tuple[type, tuple[str, ...]]] = [
    (Post, ("title", "content")),
    (Comment, ("content",)),
    (Message, ("content",)),
    (GroupMessage, ("content",)),
]


def rewrite_handle(db: Session, old_handle: str, new_handle: str) -> int:
    """Troca `@old_handle` por `@new_handle` em todo texto já publicado.

    Devolve quantas linhas foram alteradas. O `LIKE` é só um filtro barato pra
    não carregar a tabela inteira — quem decide o que é menção de verdade é o
    regex (`@ana` não casa dentro de `@ana.silva` nem de `a@ana.com`).
    """
    pattern = mention_pattern(old_handle)
    replacement = f"@{new_handle}"
    changed = 0

    for model, fields in _MENTION_FIELDS:
        like = f"%@{old_handle}%"
        rows = (
            db.query(model)
            .filter(or_(*[getattr(model, f).ilike(like) for f in fields]))
            .all()
        )
        for row in rows:
            touched = False
            for field in fields:
                text = getattr(row, field)
                if not text:
                    continue
                new_text = pattern.sub(replacement, text)
                if new_text != text:
                    setattr(row, field, new_text)
                    touched = True
            if touched:
                changed += 1

    if changed:
        db.commit()
    return changed

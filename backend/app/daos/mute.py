from datetime import datetime

from sqlalchemy.orm import Session

from app.models.mute import ConversationMute


def get(db: Session, user_id: int, kind: str, target_id: int) -> ConversationMute | None:
    return (
        db.query(ConversationMute)
        .filter(
            ConversationMute.user_id == user_id,
            ConversationMute.kind == kind,
            ConversationMute.target_id == target_id,
        )
        .first()
    )


def upsert(
    db: Session, user_id: int, kind: str, target_id: int, muted_until: datetime | None
) -> ConversationMute:
    row = get(db, user_id, kind, target_id)
    if row:
        row.muted_until = muted_until
    else:
        row = ConversationMute(
            user_id=user_id, kind=kind, target_id=target_id, muted_until=muted_until
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


def remove(db: Session, user_id: int, kind: str, target_id: int) -> None:
    row = get(db, user_id, kind, target_id)
    if row:
        db.delete(row)
        db.commit()


def active_target_ids(db: Session, user_id: int, kind: str) -> set[int]:
    """Ids (do outro usuário, em DM, ou do grupo) atualmente silenciados —
    usado pra excluir da contagem agregada de não lidas (ver services/message.py)."""
    rows = (
        db.query(ConversationMute)
        .filter(ConversationMute.user_id == user_id, ConversationMute.kind == kind)
        .all()
    )
    return {r.target_id for r in rows if r.is_active}


def active_map(db: Session, user_id: int, kind: str) -> dict[int, ConversationMute]:
    """target_id → linha, só as ainda ativas — usado nas listagens (evita
    reconsultar uma-a-uma pra cada conversa/grupo)."""
    rows = (
        db.query(ConversationMute)
        .filter(ConversationMute.user_id == user_id, ConversationMute.kind == kind)
        .all()
    )
    return {r.target_id: r for r in rows if r.is_active}

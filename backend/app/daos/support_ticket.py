from datetime import datetime, timezone

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.support_ticket import STATUS_ANSWERED, SupportTicket


def get_by_id(db: Session, ticket_id: int) -> SupportTicket | None:
    return db.get(SupportTicket, ticket_id)


def create(db: Session, user_id: int, subject: str, message: str) -> SupportTicket:
    ticket = SupportTicket(user_id=user_id, subject=subject, message=message)
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def list_for_user(db: Session, user_id: int) -> list[SupportTicket]:
    return (
        db.query(SupportTicket)
        .filter(SupportTicket.user_id == user_id)
        .order_by(desc(SupportTicket.created_at))
        .all()
    )


def list_all(db: Session, status: str | None, offset: int, limit: int) -> list[SupportTicket]:
    q = db.query(SupportTicket)
    if status:
        q = q.filter(SupportTicket.status == status)
    return q.order_by(desc(SupportTicket.created_at)).offset(offset).limit(limit).all()


def count(db: Session, status: str | None) -> int:
    q = db.query(func.count(SupportTicket.id))
    if status:
        q = q.filter(SupportTicket.status == status)
    return q.scalar() or 0


def reply(db: Session, ticket: SupportTicket, response: str) -> SupportTicket:
    ticket.response = response
    ticket.status = STATUS_ANSWERED
    ticket.responded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ticket)
    return ticket

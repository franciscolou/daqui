from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_moderator, get_current_user, get_db
from app.models.user import User
from app.schemas.support_ticket import (
    SupportTicketAdminOut,
    SupportTicketCreate,
    SupportTicketOut,
    SupportTicketReply,
    SupportTicketStats,
)
from app.services import support_ticket as ticket_service


# ── Usuário (app Daqui) ───────────────────────────────────────────────
def submit_ticket(
    payload: SupportTicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SupportTicketOut:
    return ticket_service.submit(db, current_user, payload)


def list_my_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SupportTicketOut]:
    return ticket_service.list_mine(db, current_user)


# ── Moderador (app de moderação) ──────────────────────────────────────
def list_tickets(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> list[SupportTicketAdminOut]:
    return ticket_service.admin_list(db, status, page, page_size)


def tickets_stats(
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> SupportTicketStats:
    return ticket_service.admin_stats(db)


def reply_ticket(
    ticket_id: int,
    payload: SupportTicketReply,
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> SupportTicketAdminOut:
    return ticket_service.admin_reply(db, ticket_id, payload, _mod)

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.daos import support_ticket as ticket_dao
from app.models.audit_log import ACTION_TICKET_REPLY
from app.models.support_ticket import SupportTicket
from app.models.user import User
from app.schemas.support_ticket import (
    SupportTicketAdminOut,
    SupportTicketCreate,
    SupportTicketOut,
    SupportTicketReply,
    SupportTicketStats,
)
from app.schemas.user import UserPublic
from app.services import audit_log as audit_log_service


def submit(db: Session, user: User, payload: SupportTicketCreate) -> SupportTicketOut:
    ticket = ticket_dao.create(db, user.id, payload.subject, payload.message)
    return SupportTicketOut.model_validate(ticket)


def list_mine(db: Session, user: User) -> list[SupportTicketOut]:
    tickets = ticket_dao.list_for_user(db, user.id)
    return [SupportTicketOut.model_validate(t) for t in tickets]


# ── Moderação ─────────────────────────────────────────────────────────
def _admin_out(ticket: SupportTicket) -> SupportTicketAdminOut:
    out = SupportTicketAdminOut.model_validate(ticket)
    out.user = UserPublic.model_validate(ticket.user)
    return out


def admin_list(db: Session, status: str | None, page: int, page_size: int) -> list[SupportTicketAdminOut]:
    offset = (page - 1) * page_size
    tickets = ticket_dao.list_all(db, status, offset, page_size)
    return [_admin_out(t) for t in tickets]


def admin_stats(db: Session) -> SupportTicketStats:
    return SupportTicketStats(
        total=ticket_dao.count(db, None),
        pending=ticket_dao.count(db, "pending"),
    )


def admin_reply(
    db: Session, ticket_id: int, payload: SupportTicketReply, moderator: User
) -> SupportTicketAdminOut:
    ticket = ticket_dao.get_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    detail = f"Chamado #{ticket.id} — {ticket.subject}"
    ticket = ticket_dao.reply(db, ticket, payload.response)
    audit_log_service.log(db, moderator, ACTION_TICKET_REPLY, ticket.user_id, detail)
    return _admin_out(ticket)

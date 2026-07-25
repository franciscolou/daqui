from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.uploads import save_upload_media
from app.daos import support_ticket as ticket_dao
from app.models.audit_log import AuditLogAction
from app.models.support_ticket import SupportTicket, SupportTicketStatus
from app.models.user import User
from app.schemas.attachment import AttachmentItem
from app.schemas.support_ticket import (
    SupportTicketAdminOut,
    SupportTicketCreate,
    SupportTicketOut,
    SupportTicketReply,
    SupportTicketStats,
)
from app.schemas.user import UserPublic
from app.services import audit_log as audit_log_service


def upload_attachment(user: User, base_url: str, file: UploadFile) -> AttachmentItem:
    url, media_type = save_upload_media(base_url, file, prefix=f"ticket_{user.id}")
    return AttachmentItem(url=url, type=media_type)


def submit(db: Session, user: User, payload: SupportTicketCreate) -> SupportTicketOut:
    attachments = [a.model_dump() for a in payload.attachments]
    ticket = ticket_dao.create(db, user.id, payload.subject, payload.message, attachments)
    return SupportTicketOut.model_validate(ticket)


def list_mine(db: Session, user: User) -> list[SupportTicketOut]:
    tickets = ticket_dao.list_for_user(db, user.id)
    return [SupportTicketOut.model_validate(t) for t in tickets]


# ── Moderação ─────────────────────────────────────────────────────────
def _admin_out(ticket: SupportTicket) -> SupportTicketAdminOut:
    out = SupportTicketAdminOut.model_validate(ticket)
    out.user = UserPublic.model_validate(ticket.user)
    return out


def admin_list(
    db: Session, status: SupportTicketStatus | None, page: int, page_size: int
) -> list[SupportTicketAdminOut]:
    offset = (page - 1) * page_size
    tickets = ticket_dao.list_all(db, status, offset, page_size)
    return [_admin_out(t) for t in tickets]


def admin_stats(db: Session) -> SupportTicketStats:
    return SupportTicketStats(
        total=ticket_dao.count(db, None),
        pending=ticket_dao.count(db, SupportTicketStatus.PENDING),
    )


def admin_reply(
    db: Session, ticket_id: int, payload: SupportTicketReply, moderator: User
) -> SupportTicketAdminOut:
    ticket = ticket_dao.get_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    detail = f"#{ticket.id} — {ticket.subject}"
    ticket = ticket_dao.reply(db, ticket, payload.response)
    audit_log_service.log(db, moderator, AuditLogAction.TICKET_REPLY, ticket.user_id, detail)
    return _admin_out(ticket)

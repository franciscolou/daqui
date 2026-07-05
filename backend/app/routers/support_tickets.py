from fastapi import APIRouter

from app.controllers import support_ticket
from app.schemas.support_ticket import SupportTicketAdminOut, SupportTicketOut, SupportTicketStats

# App Daqui (usuário): abrir um chamado e ver os próprios (com a resposta, se houver).
router = APIRouter(prefix="/support-tickets", tags=["support-tickets"])
router.post("/", response_model=SupportTicketOut, status_code=201)(support_ticket.submit_ticket)
router.get("/mine", response_model=list[SupportTicketOut])(support_ticket.list_my_tickets)

# App de moderação: listar e responder chamados.
admin_router = APIRouter(prefix="/admin/support-tickets", tags=["moderation"])
admin_router.get("/stats", response_model=SupportTicketStats)(support_ticket.tickets_stats)
admin_router.get("", response_model=list[SupportTicketAdminOut])(support_ticket.list_tickets)
admin_router.patch("/{ticket_id}/reply", response_model=SupportTicketAdminOut)(support_ticket.reply_ticket)

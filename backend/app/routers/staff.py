from fastapi import APIRouter

from app.controllers import staff
from app.schemas.auth import TokenResponse
from app.schemas.staff import StaffInviteInfo, StaffOut

# App de moderação: gestão de contas de staff (Moderador/Administrador), restrita
# a Administrador/Owner (ver core/deps.py::get_current_admin) — exceto o par
# GET/POST "/invite" que resolve/aceita o convite, aberto (sem sessão: quem
# está aceitando ainda não tem conta).
admin_router = APIRouter(prefix="/admin/staff", tags=["moderation"])
admin_router.get("", response_model=list[StaffOut])(staff.admin_list_staff)
admin_router.post("/invite", status_code=204)(staff.admin_invite_staff)
admin_router.get("/invite", response_model=StaffInviteInfo)(staff.admin_check_invite)
admin_router.post("/accept-invite", response_model=TokenResponse)(staff.admin_accept_invite)
admin_router.patch("/{user_id}/username", response_model=StaffOut)(staff.admin_rename_staff)
admin_router.post("/{user_id}/suspend", response_model=StaffOut)(staff.admin_suspend_staff)
admin_router.delete("/{user_id}/suspend", response_model=StaffOut)(staff.admin_unsuspend_staff)
admin_router.delete("/{user_id}", response_model=StaffOut)(staff.admin_delete_staff)

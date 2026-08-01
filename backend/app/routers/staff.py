from fastapi import APIRouter

from app.controllers import staff
from app.schemas.staff import StaffOut

# App de moderação: gestão de contas de staff (Moderador/Administrador), restrita
# a Administrador/Owner (ver core/deps.py::get_current_admin).
admin_router = APIRouter(prefix="/admin/staff", tags=["moderation"])
admin_router.get("", response_model=list[StaffOut])(staff.admin_list_staff)
admin_router.post("", response_model=StaffOut, status_code=201)(staff.admin_create_staff)
admin_router.patch("/{user_id}/username", response_model=StaffOut)(staff.admin_rename_staff)
admin_router.post("/{user_id}/suspend", response_model=StaffOut)(staff.admin_suspend_staff)
admin_router.delete("/{user_id}/suspend", response_model=StaffOut)(staff.admin_unsuspend_staff)
admin_router.delete("/{user_id}", response_model=StaffOut)(staff.admin_delete_staff)

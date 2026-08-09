from fastapi import APIRouter

from app.controllers import trash
from app.schemas.trash import TrashItemOut

admin_router = APIRouter(prefix="/admin/trash", tags=["moderation"])
admin_router.get("/", response_model=list[TrashItemOut])(trash.list_items)
admin_router.post("/{item_type}/{item_id}/restore", status_code=204)(trash.restore_item)


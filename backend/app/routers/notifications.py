from fastapi import APIRouter

from app.controllers import notification
from app.schemas.notification import NotificationOut, UnreadCountOut

router = APIRouter(prefix="/notifications", tags=["notifications"])

# Rota estática antes de qualquer futura dinâmica /{id}.
router.get(   "/unread-count", response_model=UnreadCountOut)(notification.get_unread_count)
router.get(   "/",             response_model=list[NotificationOut])(notification.list_notifications)
router.patch( "/read-all",     status_code=204)(notification.mark_all_read)

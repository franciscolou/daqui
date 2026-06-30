from fastapi import APIRouter

from app.controllers import notification
from app.schemas.notification import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])

router.get(   "/",          response_model=list[NotificationOut])(notification.list_notifications)
router.patch( "/read-all",  status_code=204)(notification.mark_all_read)

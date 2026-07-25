from pydantic import BaseModel

from app.core.uploads import MediaType

# Usado tanto por chamados de suporte quanto por denúncias — ver
# schemas/support_ticket.py e schemas/report.py.
MAX_ATTACHMENTS = 3


class AttachmentItem(BaseModel):
    url: str
    type: MediaType

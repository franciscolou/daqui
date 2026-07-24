from typing import Literal

from pydantic import BaseModel

# Usado tanto por chamados de suporte quanto por denúncias — ver
# schemas/support_ticket.py e schemas/report.py.
MAX_ATTACHMENTS = 3


class AttachmentItem(BaseModel):
    url: str
    type: Literal["image", "video"]

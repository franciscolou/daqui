from datetime import datetime

from pydantic import BaseModel


class SessionOut(BaseModel):
    id: int
    device_name: str
    created_at: datetime
    # Sessão do próprio token usado na requisição — não pode ser desconectada por aqui.
    is_current: bool

    model_config = {"from_attributes": True}

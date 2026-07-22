from datetime import datetime
from typing import Literal

from pydantic import BaseModel

# Opções de duração do silenciamento — "forever" fica silenciado até o
# usuário reativar manualmente (ver services/mutes.py::resolve_until).
MuteDuration = Literal["8h", "1d", "1w", "forever"]


class MuteIn(BaseModel):
    duration: MuteDuration


class MuteStatusOut(BaseModel):
    is_muted: bool
    # None quando não silenciado, ou quando silenciado por tempo indeterminado.
    muted_until: datetime | None = None

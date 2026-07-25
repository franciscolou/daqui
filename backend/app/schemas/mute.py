from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class MuteDuration(StrEnum):
    """Opções de duração do silenciamento — FOREVER fica silenciado até o
    usuário reativar manualmente (ver services/mutes.py::resolve_until)."""

    EIGHT_HOURS = "8h"
    ONE_DAY = "1d"
    ONE_WEEK = "1w"
    FOREVER = "forever"


class MuteIn(BaseModel):
    duration: MuteDuration


class MuteStatusOut(BaseModel):
    is_muted: bool
    # None quando não silenciado, ou quando silenciado por tempo indeterminado.
    muted_until: datetime | None = None

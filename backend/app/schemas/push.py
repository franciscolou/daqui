from typing import Literal

from pydantic import BaseModel


class PushTokenIn(BaseModel):
    token: str
    platform: Literal["ios", "android"]

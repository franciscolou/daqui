from pydantic import BaseModel

from app.models.push_token import PushPlatform


class PushTokenIn(BaseModel):
    token: str
    platform: PushPlatform

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from app.schemas.user import UserPublic


class ReviewCreate(BaseModel):
    rating: float
    comment: str = ""

    @field_validator("rating")
    @classmethod
    def check_rating(cls, v: float) -> float:
        # 0 a 5, em passos de 0,5.
        if v < 0 or v > 5 or (v * 2) % 1 != 0:
            raise ValueError("A nota deve ser de 0 a 5, em passos de 0,5")
        return v

    @field_validator("comment")
    @classmethod
    def check_comment(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 1000:
            raise ValueError("O comentário deve ter no máximo 1000 caracteres")
        return v


class ReviewOut(BaseModel):
    id: int
    rating: float
    comment: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReviewAdminOut(ReviewOut):
    author: UserPublic


class ReviewStats(BaseModel):
    total: int
    average: Optional[float]

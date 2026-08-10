from pydantic import BaseModel, Field


class AdSettingsOut(BaseModel):
    price_multiplier: float

    model_config = {"from_attributes": True}


class AdSettingsUpdate(BaseModel):
    price_multiplier: float = Field(gt=0)

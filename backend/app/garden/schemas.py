from datetime import date

from pydantic import BaseModel


class BeetAddRequest(BaseModel):
    plant_slug: str


class BeetItem(BaseModel):
    plant_slug: str
    deutscher_name: str
    planted_on: date
    model_config = {"from_attributes": True}

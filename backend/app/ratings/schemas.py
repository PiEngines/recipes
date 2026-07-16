from pydantic import BaseModel, Field

class RatingIn(BaseModel):
    stars: int = Field(ge=1, le=5)

class RatingAggregate(BaseModel):
    avg: float | None = None
    count: int = 0
    my_stars: int | None = None

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.external_post import ExternalPlatform


class ExternalPostCreate(BaseModel):
    platform: ExternalPlatform
    url: str = Field(min_length=1, max_length=1000)


class ExternalPostItem(BaseModel):
    """Kompakte Form — auch von den Sammlungen verwendet."""

    id: int
    platform: str
    url: str
    thumbnail_url: str | None = None
    author_name: str | None = None
    model_config = {"from_attributes": True}


class ExternalPostDetail(ExternalPostItem):
    created_by: int
    oembed_html: str | None = None
    caption_text: str | None = None
    extracted_ingredients: list | dict | None = None
    created_at: datetime

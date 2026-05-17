from datetime import datetime

from pydantic import BaseModel, computed_field

from app.storage import storage


class MediaOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    media_type: str
    filename: str
    original_filename: str | None
    mime_type: str | None
    size_bytes: int | None
    width: int | None
    height: int | None
    duration_seconds: float | None
    processing_status: str
    is_primary: bool
    sort_order: int
    storage_backend: str
    storage_path: str
    thumbnail_path: str | None
    created_at: datetime
    uploaded_by: int

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def url(self) -> str:
        return storage.get_url(self.storage_path)

    @computed_field
    @property
    def thumbnail_url(self) -> str | None:
        if self.thumbnail_path:
            return storage.get_url(self.thumbnail_path)
        return None


class MediaStatusOut(BaseModel):
    id: int
    processing_status: str

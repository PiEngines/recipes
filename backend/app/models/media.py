from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Media(Base):
    __tablename__ = "media"

    id = Column(Integer, primary_key=True)
    entity_type = Column(String(50), nullable=False, index=True)   # "recipe", "step", "comment"
    entity_id = Column(Integer, nullable=False, index=True)         # FK-loose ref
    media_type = Column(String(20), nullable=False)                  # "image", "video"

    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500))
    mime_type = Column(String(100))
    size_bytes = Column(Integer)

    width = Column(Integer)           # images only
    height = Column(Integer)          # images only
    duration_seconds = Column(Float)  # videos only

    processing_status = Column(String(20), nullable=False, default="ready")  # ready|processing|error
    is_primary = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)

    storage_backend = Column(String(20), nullable=False, default="local")
    storage_path = Column(String(1000), nullable=False)
    thumbnail_path = Column(String(1000))

    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploader = relationship("User", foreign_keys=[uploaded_by])

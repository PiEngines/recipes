from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class RecipeAccess(Base):
    __tablename__ = "recipe_access"

    id = Column(Integer, primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    access_type = Column(String(20), nullable=False)  # 'free_for_all' | 'individual'
    email = Column(String(255), nullable=True)
    token = Column(String(128), unique=True, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    expires_at_individual = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    declined_at = Column(DateTime(timezone=True), nullable=True)
    declined_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    page = Column(Integer, default=1)
    page_size = Column(Integer, default=20)
    notified_at = Column(DateTime(timezone=True), nullable=True)
    is_pending_review = Column(Boolean, nullable=True, default=False)


class DisposableEmailDomain(Base):
    __tablename__ = "disposable_email_domains"

    id = Column(Integer, primary_key=True)
    domain = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

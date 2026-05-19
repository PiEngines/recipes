import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class UserRole(str, enum.Enum):
    kuechenchef = "kuechenchef"
    chefkoch = "chefkoch"
    koch = "koch"
    kuechenhilfe = "kuechenhilfe"
    # Legacy — kept for backward compatibility during migration
    admin = "admin"
    autor = "autor"
    leser = "leser"
    full = "full"
    limited = "limited"
    single = "single"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, name="user_role"), nullable=False, default=UserRole.kuechenhilfe)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    email_notifications = Column(Boolean, nullable=False, default=True)
    dark_mode_preference = Column(String(10))
    status = Column(String(20), nullable=False, default="active")
    email_verified = Column(Boolean, nullable=False, default=False)

    recipes = relationship("Recipe", back_populates="author", foreign_keys="Recipe.created_by")
    collections = relationship("Collection", back_populates="owner")
    cooked_logs = relationship("CookedLog", back_populates="cooked_by_user")

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
    username = Column(String(255), unique=True, nullable=True, index=True)
    avatar_url = Column(String(500), nullable=True)
    bio = Column(String(500), nullable=True)
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
    # Vorlieben (BUG-41): Freitext (MVP — strukturierte Tags wären ein eigener
    # FR). `preferences_public` schaltet die Anzeige auf dem Profil frei; ohne
    # den Toggle bleiben sie privat und sind nur in den Einstellungen sichtbar.
    preferences = Column(String(2000), nullable=True)
    preferences_public = Column(Boolean, nullable=False, default=False)
    # Ernährungsprofil (Ü18): Ernährungsweise und Ausschlüsse können aufs Profil
    # geteilt werden, Allergien bewusst nie (kein Flag) — sie werden nie
    # öffentlich gezeigt und nie als „sicher"/Garantie gelabelt.
    diet_public = Column(Boolean, nullable=False, default=False)
    exclusions_public = Column(Boolean, nullable=False, default=False)

    recipes = relationship("Recipe", back_populates="author", foreign_keys="Recipe.created_by")
    collections = relationship("Collection", back_populates="owner")
    diet_labels = relationship("DietLabel", secondary="user_diet_labels")
    allergens = relationship("Allergen", secondary="user_allergens")
    exclusions = relationship("Exclusion", secondary="user_exclusions")
    cooked_logs = relationship("CookedLog", back_populates="cooked_by_user")

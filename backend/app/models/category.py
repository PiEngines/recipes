from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.associations import recipe_allergens, recipe_categories, recipe_diet_labels, recipe_tags


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    slug = Column(String(255), nullable=False, unique=True, index=True)

    recipes = relationship("Recipe", secondary=recipe_categories, back_populates="categories")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)

    recipes = relationship("Recipe", secondary=recipe_tags, back_populates="tags")


class DietLabel(Base):
    __tablename__ = "diet_labels"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)

    recipes = relationship("Recipe", secondary=recipe_diet_labels, back_populates="diet_labels")


class Allergen(Base):
    __tablename__ = "allergens"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)

    recipes = relationship("Recipe", secondary=recipe_allergens, back_populates="allergens")


class Exclusion(Base):
    """Was jemand generell nicht isst (Schweinefleisch, Alkohol …) — analog zu
    DietLabel/Allergen, aber vorerst nur am User-Profil (Ü18). Eine Rezept-Seite
    bekommt sie erst mit dem Folge-FR (FR-Ernährungs-Filter)."""

    __tablename__ = "exclusions"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)

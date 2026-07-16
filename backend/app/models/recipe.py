import enum

from sqlalchemy import ARRAY, Boolean, Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.associations import (
    recipe_allergens,
    recipe_categories,
    recipe_diet_labels,
    recipe_tags,
)


class RecipeStatus(str, enum.Enum):
    published = "published"


class RecipeType(str, enum.Enum):
    kochen = "kochen"
    backen = "backen"
    grillen = "grillen"
    braten = "braten"
    daempfen = "daempfen"
    einkochen = "einkochen"
    rohkost = "rohkost"


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    prep_time = Column(Integer)
    cook_time = Column(Integer)
    servings = Column(Integer)
    difficulty = Column(Integer)  # 1–5
    status = Column(Enum(RecipeStatus, name="recipe_status"), nullable=False, default=RecipeStatus.published)
    type = Column(String(20), nullable=False, default=RecipeType.kochen.value)
    course = Column(String(50), nullable=True, default=None)
    source = Column(String(500))
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    pending_version_id = Column(Integer, ForeignKey("recipe_versions.id"), nullable=True)
    review_status = Column(String(20), nullable=False, default="none")
    thumbnail_style = Column(String(20), nullable=False, default="crop")  # "crop" | "blur"
    matching_reviewed_at = Column(DateTime(timezone=True), nullable=True)  # NULL = ingredient matching never reviewed
    seasonal_tags = Column(ARRAY(String), nullable=True, server_default="{}")

    author = relationship("User", back_populates="recipes", foreign_keys=[created_by])
    steps = relationship("RecipeStep", back_populates="recipe", order_by="RecipeStep.sort_order", cascade="all, delete-orphan")
    ingredients = relationship("Ingredient", back_populates="recipe", order_by="Ingredient.sort_order", cascade="all, delete-orphan")
    videos = relationship("RecipeVideo", back_populates="recipe", cascade="all, delete-orphan")
    versions = relationship(
        "RecipeVersion",
        foreign_keys="RecipeVersion.recipe_id",
        back_populates="recipe",
        cascade="all, delete-orphan",
    )
    pending_version = relationship(
        "RecipeVersion",
        foreign_keys="[Recipe.pending_version_id]",
    )
    cooked_logs = relationship("CookedLog", back_populates="recipe", cascade="all, delete-orphan")
    collection_entries = relationship("CollectionRecipe", back_populates="recipe", cascade="all, delete-orphan")

    categories = relationship("Category", secondary=recipe_categories, back_populates="recipes")
    tags = relationship("Tag", secondary=recipe_tags, back_populates="recipes")
    diet_labels = relationship("DietLabel", secondary=recipe_diet_labels, back_populates="recipes")
    allergens = relationship("Allergen", secondary=recipe_allergens, back_populates="recipes")

    # This recipe acts as parent (contains other recipes as components)
    child_components = relationship(
        "RecipeComponent",
        foreign_keys="RecipeComponent.parent_recipe_id",
        back_populates="parent_recipe",
        cascade="all, delete-orphan",
    )
    # This recipe appears as a component inside other recipes
    parent_components = relationship(
        "RecipeComponent",
        foreign_keys="RecipeComponent.child_recipe_id",
        back_populates="child_recipe",
    )
    # "Passt dazu"-Verknüpfungen (ausgehend von diesem Rezept)
    serve_with_entries = relationship(
        "RecipeServeWith",
        foreign_keys="RecipeServeWith.recipe_id",
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="RecipeServeWith.position",
    )


class RecipeStep(Base):
    __tablename__ = "recipe_steps"

    id = Column(Integer, primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    sort_order = Column(Integer, nullable=False)
    title = Column(String(255), nullable=True)
    instruction = Column(Text, nullable=False)
    timer_seconds = Column(Integer)
    timer_label = Column(String(255), nullable=True)
    image_path = Column(String(500))
    video_path = Column(String(500))
    ingredient_ids = Column(JSONB, nullable=True)  # manual override; None = use auto-detection
    ingredient_ids_auto = Column(JSONB, nullable=True)  # system-suggested matches, overwritten on every rematch

    recipe = relationship("Recipe", back_populates="steps")


class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    component_label = Column(String(255))  # e.g. "For the sauce"
    name = Column(String(255), nullable=False)
    amount = Column(String(100))           # string to support "½", "a pinch", etc.
    unit = Column(String(100))
    sort_order = Column(Integer, nullable=False, default=0)
    is_integer = Column(Boolean, nullable=False, default=False)
    bls_id = Column(String(50), nullable=True)  # reference into the Bundeslebensmittelschlüssel, for future nutrition data

    recipe = relationship("Recipe", back_populates="ingredients")


class RecipeVideo(Base):
    __tablename__ = "recipe_videos"

    id = Column(Integer, primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    recipe = relationship("Recipe", back_populates="videos")


class RecipeComponent(Base):
    """Self-referential M2M: a recipe that embeds other recipes as sub-recipes."""

    __tablename__ = "recipe_components"

    parent_recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True)
    child_recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True)
    sort_order = Column(Integer, nullable=False, default=0)
    flatten_into_parent = Column(Boolean, nullable=False, default=False)
    servings_override = Column(Integer, nullable=True)
    scale_factor = Column(Numeric(precision=10, scale=4), nullable=True)
    referenced_version_id = Column(Integer, ForeignKey("recipe_versions.id", ondelete="SET NULL"), nullable=True)

    parent_recipe = relationship("Recipe", foreign_keys=[parent_recipe_id], back_populates="child_components")
    child_recipe = relationship("Recipe", foreign_keys=[child_recipe_id], back_populates="parent_components")
    referenced_version = relationship("RecipeVersion", foreign_keys=[referenced_version_id])


class RecipeVersion(Base):
    __tablename__ = "recipe_versions"

    id = Column(Integer, primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    snapshot = Column(JSONB, nullable=False)
    changed_fields_count = Column(Integer, nullable=True)
    changed_chars_count = Column(Integer, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    notified_at = Column(DateTime(timezone=True), nullable=True)

    recipe = relationship(
        "Recipe",
        foreign_keys="[RecipeVersion.recipe_id]",
        back_populates="versions",
    )


class RecipeServeWith(Base):
    """Ordered list of recipes that pair well with a given recipe."""

    __tablename__ = "recipe_serve_with"

    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    serve_with_recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    position = Column(Integer, nullable=False, default=0)

    recipe = relationship("Recipe", foreign_keys=[recipe_id], back_populates="serve_with_entries")
    serve_with_recipe = relationship("Recipe", foreign_keys=[serve_with_recipe_id])

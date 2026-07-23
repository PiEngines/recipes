from sqlalchemy import Column, ForeignKey, Integer, Table

from app.database import Base

recipe_categories = Table(
    "recipe_categories",
    Base.metadata,
    Column("recipe_id", Integer, ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", Integer, ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
)

recipe_tags = Table(
    "recipe_tags",
    Base.metadata,
    Column("recipe_id", Integer, ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

recipe_diet_labels = Table(
    "recipe_diet_labels",
    Base.metadata,
    Column("recipe_id", Integer, ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
    Column("diet_label_id", Integer, ForeignKey("diet_labels.id", ondelete="CASCADE"), primary_key=True),
)

recipe_allergens = Table(
    "recipe_allergens",
    Base.metadata,
    Column("recipe_id", Integer, ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
    Column("allergen_id", Integer, ForeignKey("allergens.id", ondelete="CASCADE"), primary_key=True),
)

# Ernährungsprofil des Nutzers (BUG-41 / Ü18). Das ist das *Erfassen* — die
# Rezept-Seite bleibt unangetastet, das aktive Filtern ist ein Folge-FR.
user_diet_labels = Table(
    "user_diet_labels",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("diet_label_id", Integer, ForeignKey("diet_labels.id", ondelete="CASCADE"), primary_key=True),
)

user_allergens = Table(
    "user_allergens",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("allergen_id", Integer, ForeignKey("allergens.id", ondelete="CASCADE"), primary_key=True),
)

user_exclusions = Table(
    "user_exclusions",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("exclusion_id", Integer, ForeignKey("exclusions.id", ondelete="CASCADE"), primary_key=True),
)

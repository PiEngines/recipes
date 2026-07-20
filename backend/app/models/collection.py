import enum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class CollectionVisibility(str, enum.Enum):
    """Sichtbarkeit je Sammlung. String-Spalte + Python-Enum (kein PG-Enum)."""

    private = "private"
    public = "public"


class CollectionItemType(str, enum.Enum):
    """Polymorpher Item-Typ. Später erweiterbar (z. B. `plant_spotlight`)."""

    recipe = "recipe"
    external_post = "external_post"


class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    visibility = Column(String(10), nullable=False, server_default="private")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    owner = relationship("User", back_populates="collections")
    recipes = relationship(
        "CollectionRecipe",
        back_populates="collection",
        order_by="CollectionRecipe.sort_order",
        cascade="all, delete-orphan",
    )


class CollectionItem(Base):
    """Polymorpher Eintrag einer Sammlung.

    `item_id` trägt bewusst KEINEN Fremdschlüssel — die Referenz zeigt je nach
    `item_type` auf verschiedene Tabellen. Die Existenz wird beim Hinzufügen
    App-seitig geprüft.
    """

    __tablename__ = "collection_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    collection_id = Column(
        Integer, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_type = Column(String(20), nullable=False)  # CollectionItemType
    item_id = Column(Integer, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    added_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("collection_id", "item_type", "item_id", name="uq_collection_item"),
    )


class CollectionRecipe(Base):
    """Deprecated — abgelöst durch `CollectionItem`.

    Bleibt samt Tabelle unangetastet stehen; es gab nie eine API, die hier
    geschrieben hätte. Keine Datenmigration.
    """

    __tablename__ = "collection_recipes"

    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True)
    sort_order = Column(Integer, nullable=False, default=0)

    collection = relationship("Collection", back_populates="recipes")
    recipe = relationship("Recipe", back_populates="collection_entries")

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    owner = relationship("User", back_populates="collections")
    recipes = relationship(
        "CollectionRecipe",
        back_populates="collection",
        order_by="CollectionRecipe.sort_order",
        cascade="all, delete-orphan",
    )


class CollectionRecipe(Base):
    __tablename__ = "collection_recipes"

    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True)
    sort_order = Column(Integer, nullable=False, default=0)

    collection = relationship("Collection", back_populates="recipes")
    recipe = relationship("Recipe", back_populates="collection_entries")

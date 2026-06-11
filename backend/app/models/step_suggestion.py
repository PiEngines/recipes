from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class StepUnmatchedSuggestion(Base):
    __tablename__ = "step_unmatched_suggestions"

    id = Column(Integer, primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    step_id = Column(Integer, ForeignKey("recipe_steps.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(255), nullable=False)
    bls_id = Column(String(50), nullable=False)
    bls_name = Column(String(255), nullable=False)
    confidence = Column(String(20), nullable=False)  # "eindeutig" | "verdacht"
    status = Column(String(20), nullable=False, default="open")  # "open" | "accepted" | "dismissed"
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    recipe = relationship("Recipe")
    step = relationship("RecipeStep")

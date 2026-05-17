from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class CookedLog(Base):
    __tablename__ = "cooked_log"

    id = Column(Integer, primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    cooked_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    cooked_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    notes = Column(Text)

    recipe = relationship("Recipe", back_populates="cooked_logs")
    cooked_by_user = relationship("User", back_populates="cooked_logs")

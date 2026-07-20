from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, func

from app.database import Base


class PlantSpotlightHistory(Base):
    """Kraut-des-Monats — genau ein Pick je Monat, persistiert.

    Unique(period_key) hält den Pick innerhalb eines Monats stabil und schützt
    zugleich gegen parallele Erstaufrufe. Die Historie dient dem 12-Monats-
    Cooldown (keine Wiederholung innerhalb eines Jahres).
    """

    __tablename__ = "plant_spotlight_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plant_id = Column(String(20), ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True)
    period_key = Column(String(7), nullable=False)  # "YYYY-MM"
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("period_key", name="uq_spotlight_period"),)

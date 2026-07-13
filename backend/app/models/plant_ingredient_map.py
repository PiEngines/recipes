"""Kräuterschule Phase 4 – Brücken-Model Pflanze <-> Zutaten-Token.

Eigene Datei (statt Erweiterung von models/plant.py), damit Phase 4 als
geschlossener Block droppbar ist. Das Model wird über die importierenden Module
(Seed/Router) registriert; ein Eintrag in models/__init__.py ist nicht nötig,
kann aber optional ergänzt werden.
"""
from sqlalchemy import Column, ForeignKey, Integer, String, Text, UniqueConstraint

from app.database import Base


class PlantIngredientMap(Base):
    __tablename__ = "plant_ingredient_map"
    __table_args__ = (
        UniqueConstraint("pflanzen_id", "token", name="uq_plant_ingredient_map_pflanze_token"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    pflanzen_id = Column(String(20), ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True)
    # Normalisierter, synonym-expandierter Zutaten-Token (klein, ohne Satzzeichen).
    token = Column(Text, nullable=False, index=True)
    # 'derived' (aus vokabular_zutaten) | 'override' (kuratierte CSV)
    quelle = Column(String(20), nullable=False, default="derived", server_default="derived")

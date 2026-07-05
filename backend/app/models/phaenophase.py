from sqlalchemy import Column, Integer, String

from app.database import Base


class Phaenophase(Base):
    __tablename__ = "phaenophasen"

    phase_id = Column(Integer, primary_key=True, autoincrement=False)  # 1..10
    phase_name = Column(String(255), nullable=False)
    zeigerpflanze = Column(String(255), nullable=True)
    ref_monat_von = Column(Integer, nullable=False)
    ref_monat_bis = Column(Integer, nullable=False)

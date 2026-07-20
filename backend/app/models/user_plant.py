from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func

from app.database import Base


class UserPlant(Base):
    """Eine Pflanze im Beet eines Users.

    Minimal-Kern für F1 (Detail-Status „In mein Beet"); F2 (Mein-Beet-Seite,
    Kalender, Task-Engine) setzt hierauf auf. `planted_on` wird beim Anlegen
    auf heute gesetzt und ist ab F2 editierbar.
    """

    __tablename__ = "user_plants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plant_id = Column(String(20), ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True)
    planted_on = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "plant_id", name="uq_user_plant"),)

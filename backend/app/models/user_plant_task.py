from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, func

from app.database import Base


class UserPlantTaskDone(Base):
    """Erledigt-Vermerk für eine abgeleitete Beet-Aufgabe.

    Aufgaben selbst werden nicht persistiert — sie ergeben sich aus
    `user_plants.planted_on` + `plant_calendar`. Hier steht nur, was der User
    abgehakt hat.

    `period_key` ("YYYY-MM") trennt Wiederholungen: dieselbe wiederkehrende
    Aufgabe ist je Periode getrennt abhakbar.
    """

    __tablename__ = "user_plant_task_done"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_plant_id = Column(
        Integer, ForeignKey("user_plants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    task_key = Column(String(80), nullable=False)
    period_key = Column(String(7), nullable=False)  # "YYYY-MM"
    done_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_plant_id", "task_key", "period_key", name="uq_user_plant_task_period"),
    )

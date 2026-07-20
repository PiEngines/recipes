from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint, func

from app.database import Base


class UserFollow(Base):
    """Gerichtete Folge-Beziehung: `follower_id` folgt `followee_id`.

    Unique(follower_id, followee_id) macht das Folgen idempotent.
    Kein Self-Follow — das wird App-seitig geprüft, weil eine CHECK-Constraint
    dafür über Alembic mehr Reibung erzeugt als sie hier wert ist.
    """

    __tablename__ = "user_follows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    follower_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    followee_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("follower_id", "followee_id", name="uq_user_follow"),
    )

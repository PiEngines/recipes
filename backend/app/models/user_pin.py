"""Profil-Pins (Ü18): bis zu drei angepinnte Rezepte und drei Beiträge je User.

Polymorph nach demselben Muster wie `CollectionItem`: `item_id` trägt bewusst
KEINEN Fremdschlüssel — die Referenz zeigt je nach `item_type` auf
verschiedene Tabellen, die Existenz wird App-seitig geprüft. Der 3er-Deckel je
Typ wird im Endpoint erzwungen, nicht im Schema.
"""
import enum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from app.database import Base


class PinItemType(str, enum.Enum):
    recipe = "recipe"
    external_post = "external_post"


class UserPin(Base):
    __tablename__ = "user_pins"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_type = Column(String(20), nullable=False)  # PinItemType
    item_id = Column(Integer, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "item_type", "item_id", name="uq_user_pin"),
    )

import enum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


class ExternalPlatform(str, enum.Enum):
    """Erlaubte Plattformen. Bewusst nur Python-Enum — die Spalte ist String
    (Muster wie `Recipe.type`), damit neue Werte keine Enum-Migration brauchen."""

    instagram = "instagram"
    tiktok = "tiktok"


class ExternalPost(Base):
    """Ein verlinkter Beitrag von Instagram oder TikTok.

    F3a legt nur die Persistenz an: gespeichert werden Plattform und URL.
    Alle abgeleiteten Felder (`oembed_html`, `thumbnail_url`, `author_name`,
    `caption_text`, `extracted_ingredients`) bleiben leer — sie füllt F3b.
    In F3a findet kein einziger Netzwerk-Abruf statt.
    """

    __tablename__ = "external_posts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_by = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    platform = Column(String(20), nullable=False)  # ExternalPlatform
    url = Column(String(1000), nullable=False)

    # ── ab hier: Cache-/Ableitungsfelder, gefüllt erst in F3b ──────────────
    oembed_html = Column(Text, nullable=True)
    thumbnail_url = Column(String(1000), nullable=True)
    author_name = Column(String(255), nullable=True)
    caption_text = Column(Text, nullable=True)
    extracted_ingredients = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

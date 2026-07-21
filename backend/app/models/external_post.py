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

    Kern sind Plattform und URL. Die abgeleiteten Felder (`oembed_html`,
    `thumbnail_url`, `author_name`, `caption_text`, `extracted_ingredients`)
    sind ein Cache: sie füllt seit F3b-1 der oEmbed-Abruf beim Anlegen und
    bleiben leer, wenn der fehlschlägt — nachziehbar per `/refresh`.
    """

    __tablename__ = "external_posts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_by = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    platform = Column(String(20), nullable=False)  # ExternalPlatform
    url = Column(String(1000), nullable=False)

    # Optionale Verknüpfung zu einem Rezept („Rezept ansehen"). SET NULL: ein
    # gelöschtes Rezept nimmt den Beitrag nicht mit, nur die Verknüpfung.
    recipe_id = Column(
        Integer, ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # ── ab hier: Cache-/Ableitungsfelder, gefüllt erst in F3b ──────────────
    oembed_html = Column(Text, nullable=True)
    thumbnail_url = Column(String(1000), nullable=True)
    author_name = Column(String(255), nullable=True)
    caption_text = Column(Text, nullable=True)
    extracted_ingredients = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

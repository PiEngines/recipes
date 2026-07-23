"""Schemas des Fratcher-Matchings (BUG-57/58)."""
from pydantic import BaseModel, Field


class FratcherMatchRequest(BaseModel):
    """Was der Nutzer da hat — und was davon nicht zählt.

    Die Basics kommen bewusst vom Client mit: sie liegen dort im
    `localStorage` und sind nutzer-editierbar. Der Endpoint bleibt damit
    zustandslos — keine neue Tabelle, kein Server-Persist (Fork B).
    """

    ingredients: list[str] = Field(default_factory=list)
    basics: list[str] = Field(default_factory=list)


class FratcherMedia(BaseModel):
    """Das Titelbild eines Treffers — beide Größen, die Karte nimmt sich eine."""

    thumbnail_url: str | None = None
    url: str


class FratcherMatch(BaseModel):
    id: int
    title: str
    # Deckungsgrad der relevanten Zutaten, 0.0 … 1.0.
    pct: float
    # Namen der Zutaten, die der Nutzer nicht hat (Basics zählen nie mit).
    missing: list[str]
    media: FratcherMedia | None = None


class FratcherMatchResponse(BaseModel):
    """Flache Trefferliste — Buckets und Modus macht der Client (Fork C)."""

    matches: list[FratcherMatch]

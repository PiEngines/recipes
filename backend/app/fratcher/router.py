"""Fratcher — „was kann ich mit dem kochen, was da ist?" (BUG-57/58).

  POST /api/fratcher/match   – Trefferliste zu Vorrat + Basics

Bis hierher rechnete der Client: er holte die Rezeptliste, dann **je Rezept**
das Detail (für die Zutaten) und danach **je Treffer** noch die Media — bis zu
~75 Requests je Zutatenänderung. Verglichen wurde mit `includes()` auf
kleingeschriebenen Namen, „Tomaten" deckte „Tomate" also nicht.

Beides liegt jetzt hier: eine Query-Runde, und gedeckt wird über dieselbe
Synonym-plus-rapidfuzz-Logik, die auch die Schritt-Zutaten-Zuordnung benutzt
(`app.recipes.matching.name_matches`).

Zustandslos: die Basics kommen im Request mit, sie liegen beim Client im
`localStorage`. Owner-scoped über `get_current_user`, die Sichtbarkeit läuft
über denselben Filter wie die Rezeptliste.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.fratcher.schemas import (
    FratcherMatch,
    FratcherMatchRequest,
    FratcherMatchResponse,
    FratcherMedia,
)
from app.models import Recipe, User
from app.recipes.matching import name_matches
from app.recipes.router import _apply_visibility_filter, primary_media_by_recipe
from app.storage import storage

router = APIRouter(prefix="/api/fratcher", tags=["fratcher"])


def _ist_gedeckt(zutat: str, vorrat: list[str]) -> bool:
    """Hat der Nutzer etwas, das diese Rezeptzutat abdeckt?

    Bewusst über `name_matches` und nicht über einen Stringvergleich: „Tomaten"
    soll „Tomate" decken, und ein Tippfehler soll nicht zu einer fehlenden
    Zutat führen.
    """
    return any(name_matches(zutat, eigene) for eigene in vorrat)


@router.post("/match", response_model=FratcherMatchResponse)
def match(
    body: FratcherMatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Alle sichtbaren Rezepte gegen den Vorrat halten.

    Kein Deckel auf der Rezeptzahl (Fork C) — die Liste kommt in einer Query,
    das Matching läuft im Speicher. Gebucketet wird beim Client.
    """
    # Basics: exakter Vergleich in Kleinschreibung, wie bisher im Client. Hier
    # bewusst *kein* Fuzzy — wer „Öl" als Basic führt, will nicht plötzlich
    # auch „Olivenöl" verschwinden sehen.
    basics = {b.strip().lower() for b in body.basics if b and b.strip()}
    vorrat = [z.strip() for z in body.ingredients if z and z.strip()]

    q = _apply_visibility_filter(
        db.query(Recipe).filter(Recipe.deleted_at.is_(None)),
        current_user,
        db,
    )
    # Zutaten in derselben Runde — sonst wäre das N+1 nur vom Client hierher
    # gewandert.
    rezepte = q.options(selectinload(Recipe.ingredients)).all()

    treffer: list[FratcherMatch] = []
    for rezept in rezepte:
        relevant = [
            zutat.name for zutat in rezept.ingredients
            if zutat.name and zutat.name.strip() and zutat.name.strip().lower() not in basics
        ]
        # Ein Rezept, das nur aus Basics besteht, sagt über den Vorrat nichts
        # aus — es wäre immer ein Volltreffer. Früher `skip: true` im Client.
        if not relevant:
            continue

        fehlend = [name for name in relevant if not _ist_gedeckt(name, vorrat)]
        treffer.append(FratcherMatch(
            id=rezept.id,
            title=rezept.title,
            pct=(len(relevant) - len(fehlend)) / len(relevant),
            missing=fehlend,
        ))

    # Bilder erst für die tatsächlichen Treffer und in einer Query — dieselbe
    # Auswahl wie in der Rezeptliste (primär, sonst kleinster sort_order).
    medien = primary_media_by_recipe([t.id for t in treffer], db)
    for t in treffer:
        m = medien.get(t.id)
        if m:
            t.media = FratcherMedia(
                url=storage.get_url(m.storage_path),
                thumbnail_url=storage.get_url(m.thumbnail_path) if m.thumbnail_path else None,
            )

    return FratcherMatchResponse(matches=treffer)

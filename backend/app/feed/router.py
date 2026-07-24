"""Globaler Content-Stream (F3b-3).

Bewusst **kein** Follow-Aktivitäts-Feed mit Event-Fan-out, sondern eine
Aggregation über die Inhalte selbst: veröffentlichte Rezepte, verlinkte
Beiträge und das Kraut des Monats — neueste zuerst, für alle gleich. Damit
braucht es weder Event-Tabelle noch Migration; der Endpoint ist rein additiv.

**Paginierung per Cursor, nicht per Offset.** Der Stream ist live: kommt
während des Blätterns ein Rezept dazu, verschiebt Offset-Paginierung alles um
eine Position und der Leser sieht ein Item doppelt (oder gar nicht). Der
Cursor beschreibt stattdessen eine Position *im Stream*.

Die Sortierung ist eine **totale** Ordnung: `created_at desc`, dann `type asc`,
dann `id desc`. Der Zusatz ist kein Schmuck — die drei Quellen zählen ihre IDs
unabhängig, und zwei Items mit identischem `created_at` (in Postgres selten,
in SQLite je nach Auflösung regelmäßig) hätten sonst keine stabile Reihenfolge.
Ein reiner Zeitstempel-Cursor würde bei so einem Gleichstand entweder Items
überspringen (`<`) oder wiederholen (`<=`).
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload, subqueryload

from app.auth.dependencies import require_koch_or_above
from app.database import get_db
from app.external_posts.schemas import ExternalPostPublic
from app.feed.schemas import FeedItem, FeedPage
from app.models import ExternalPost, Recipe, User
from app.models.recipe import RecipeStatus
from app.plants.spotlight import resolve_spotlight
# Dieselben Batch-Helfer wie die Rezeptliste (Thumbnail und Bewertung ohne
# N+1). Bewusst wiederverwendet statt nachgebaut: eine Rezeptkachel im Feed
# soll exakt so aussehen wie eine in der Liste.
from app.recipes.router import (
    _apply_visibility_filter,
    _attach_primary_images,
    _attach_ratings,
)
from app.recipes.schemas import RecipeListItem

router = APIRouter(prefix="/api/feed", tags=["feed"])

# Rang der Typen in der Sortierung — nur als Tiebreaker bei gleichem
# `created_at` relevant. Die konkreten Zahlen sind beliebig, aber stabil.
_TYPE_RANK = {"recipe": 0, "external_post": 1, "spotlight": 2}


def _cursor_kodieren(item: FeedItem, item_id: int | None) -> str:
    return f"{item.created_at.isoformat()}|{item.type}|{item_id if item_id is not None else 0}"


def _cursor_lesen(before: str | None) -> tuple[datetime, str, int] | None:
    """Cursor → (Zeitpunkt, Typ, id). Ein blanker Zeitstempel ist erlaubt.

    Der Kurzform (nur ISO-Timestamp) fehlt der Tiebreaker; sie verhält sich
    wie ein striktes `created_at <`. Sie existiert fürs manuelle Testen und
    für Altlinks — die Antwort liefert immer die vollständige Form.
    """
    if not before:
        return None

    teile = before.split("|")
    try:
        zeitpunkt = datetime.fromisoformat(teile[0])
    except ValueError:
        raise HTTPException(status_code=422, detail="Ungültiger Cursor")

    if len(teile) == 1:
        # Hinter jedem Typ und jeder id am selben Zeitpunkt → es passieren nur
        # Items mit echt früherem `created_at`, wie ein blankes `<`.
        return zeitpunkt, max(_TYPE_RANK, key=_TYPE_RANK.get), 0

    typ = teile[1]
    if typ not in _TYPE_RANK or len(teile) != 3:
        raise HTTPException(status_code=422, detail="Ungültiger Cursor")
    try:
        item_id = int(teile[2])
    except ValueError:
        raise HTTPException(status_code=422, detail="Ungültiger Cursor")
    return zeitpunkt, typ, item_id


def _nach_cursor(spalte_zeit, spalte_id, typ: str, cursor):
    """SQL-Bedingung „steht in der Ordnung echt hinter dem Cursor"."""
    if cursor is None:
        return None
    zeitpunkt, cursor_typ, cursor_id = cursor

    bedingungen = [spalte_zeit < zeitpunkt]
    if _TYPE_RANK[typ] > _TYPE_RANK[cursor_typ]:
        # Gleicher Zeitpunkt, aber später in der Typ-Reihenfolge → noch offen.
        bedingungen.append(spalte_zeit == zeitpunkt)
    elif typ == cursor_typ:
        bedingungen.append(and_(spalte_zeit == zeitpunkt, spalte_id < cursor_id))
    return or_(*bedingungen)


def _spotlight_item(db: Session, current_user: User, cursor) -> FeedItem | None:
    """Das Kraut des Monats als genau ein Feed-Item.

    Scheitert die Ermittlung (kein Pflanzen-Zugriff, kein Kandidat, oder der
    seltene Wettlauf beim Erstaufruf), bleibt die Karte weg — der Feed als
    Ganzes darf daran nicht scheitern.
    """
    try:
        pick = resolve_spotlight(db, current_user)
    except HTTPException:
        return None
    if pick is None:
        return None

    item = FeedItem(type="spotlight", created_at=pick.created_at, spotlight=pick.spotlight)
    if cursor is not None:
        zeitpunkt, cursor_typ, cursor_id = cursor
        # Gleiche Ordnung wie in SQL, hier in Python: es ist genau ein Item.
        if not (
            item.created_at < zeitpunkt
            or (item.created_at == zeitpunkt and _TYPE_RANK["spotlight"] > _TYPE_RANK[cursor_typ])
        ):
            return None
    return item


@router.get("", response_model=FeedPage)
def get_feed(
    before: str | None = Query(None, description="Cursor der vorigen Seite (next_cursor)"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    """Globaler Mixed-Stream, neueste zuerst."""
    cursor = _cursor_lesen(before)

    # Je Quelle `limit` Items holen. Mehr kann keine Quelle zur Seite
    # beitragen — im Extremfall stellt eine allein die ganze Seite.
    rezept_q = db.query(Recipe).filter(
        Recipe.deleted_at.is_(None),
        Recipe.status == RecipeStatus.published,
    )
    # Sichtbarkeit je Rolle — sonst sähen Koch/Küchenhilfe jedes published
    # Rezept, auch nicht freigegebene fremde (Datenschutz-Leak). Der Filter
    # ist derselbe wie in `/recipes`; der Basis-Filter oben bleibt zusätzlich.
    rezept_q = _apply_visibility_filter(rezept_q, current_user, db)
    bedingung = _nach_cursor(Recipe.created_at, Recipe.id, "recipe", cursor)
    if bedingung is not None:
        rezept_q = rezept_q.filter(bedingung)
    rezepte = (
        rezept_q.options(
            subqueryload(Recipe.categories),
            subqueryload(Recipe.tags),
            joinedload(Recipe.author),
        )
        .order_by(Recipe.created_at.desc(), Recipe.id.desc())
        .limit(limit)
        .all()
    )
    _attach_primary_images(rezepte, db)
    _attach_ratings(rezepte, db)

    post_q = db.query(ExternalPost)
    bedingung = _nach_cursor(ExternalPost.created_at, ExternalPost.id, "external_post", cursor)
    if bedingung is not None:
        post_q = post_q.filter(bedingung)
    posts = (
        post_q.order_by(ExternalPost.created_at.desc(), ExternalPost.id.desc())
        .limit(limit)
        .all()
    )

    # (Item, id) — die id trägt den Tiebreaker und wandert in den Cursor.
    kandidaten: list[tuple[FeedItem, int]] = []
    for r in rezepte:
        kandidaten.append((
            FeedItem(
                type="recipe",
                created_at=r.created_at,
                recipe=RecipeListItem.model_validate(r),
            ),
            r.id,
        ))
    for p in posts:
        kandidaten.append((
            FeedItem(
                type="external_post",
                created_at=p.created_at,
                # `oembed_html` muss mit: ohne dieses Markup bleibt ein
                # TikTok-Beitrag im Feed stumm (Lehre aus F3b-2a).
                post=ExternalPostPublic.model_validate(p),
            ),
            p.id,
        ))
    kraut = _spotlight_item(db, current_user, cursor)
    if kraut is not None:
        kandidaten.append((kraut, 0))

    kandidaten.sort(key=lambda k: (-k[0].created_at.timestamp(), _TYPE_RANK[k[0].type], -k[1]))
    seite = kandidaten[:limit]

    # Kein `next_cursor`, wenn die Seite nicht voll wurde: dann war das alles,
    # was alle Quellen zusammen noch hergaben.
    next_cursor = _cursor_kodieren(*seite[-1]) if len(seite) == limit else None
    return FeedPage(items=[item for item, _ in seite], next_cursor=next_cursor)

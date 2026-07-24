"""Globaler Feed (F3b-3 · Commit 1).

`GET /api/feed` — der Mixed-Stream hinter „Entdecken" auf der Startseite.
Kein Netzwerk, echte SQLite-Session. Das Kraut des Monats ist in den meisten
Tests abgeschaltet (`resolve_spotlight` → None), damit die Reihenfolge der
Rezepte und Beiträge für sich geprüft werden kann; einen eigenen Block
bekommt es weiter unten.
"""
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import require_koch_or_above
from app.database import get_db
from app.feed.router import router as feed_router
from app.models import ExternalPost, Recipe
from app.models.recipe import RecipeStatus
from app.models.user import UserRole
from app.plants.spotlight import SpotlightPick
from app.plants.schemas import PlantSpotlight
from tests.dbfixtures import make_session_factory, make_user

BASIS = datetime(2026, 7, 1, 12, 0, 0)


@pytest.fixture
def ctx():
    Session = make_session_factory()
    db = Session()
    user = make_user(db, 1, "koechin", UserRole.koch)
    db.commit()

    app = FastAPI()
    app.include_router(feed_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_koch_or_above] = lambda: user

    # Standard: kein Kraut im Feed.
    with patch("app.feed.router.resolve_spotlight", return_value=None):
        yield TestClient(app), db
    db.close()


def _rezept(db, titel, minuten, status=RecipeStatus.published, geloescht=None):
    """Rezept mit explizitem `created_at` — `minuten` sind Minuten nach BASIS."""
    r = Recipe(
        title=titel,
        status=status,
        created_by=1,
        author_id=1,
        created_at=BASIS + timedelta(minutes=minuten),
        deleted_at=geloescht,
    )
    db.add(r)
    db.commit()
    return r


def _post(db, url, minuten, oembed="<blockquote class='tiktok-embed'></blockquote>"):
    p = ExternalPost(
        created_by=1,
        platform="tiktok",
        url=url,
        oembed_html=oembed,
        created_at=BASIS + timedelta(minutes=minuten),
    )
    db.add(p)
    db.commit()
    return p


def _titel(items):
    """Item → identifizierender String, quer über die Typen."""
    namen = []
    for i in items:
        if i["type"] == "recipe":
            namen.append(i["recipe"]["title"])
        elif i["type"] == "external_post":
            namen.append(i["post"]["url"])
        else:
            namen.append(f"kraut:{i['spotlight']['slug']}")
    return namen


# ── Mischung und Sortierung ──────────────────────────────────────────────────

def test_mischt_rezepte_und_posts_nach_created_at_desc(ctx):
    c, db = ctx
    _rezept(db, "Alt", 0)
    _post(db, "https://tiktok.com/1", 10)
    _rezept(db, "Neu", 20)
    _post(db, "https://tiktok.com/2", 30)

    daten = c.get("/api/feed").json()
    assert _titel(daten["items"]) == [
        "https://tiktok.com/2",
        "Neu",
        "https://tiktok.com/1",
        "Alt",
    ]


def test_typen_sind_ausgezeichnet(ctx):
    c, db = ctx
    _rezept(db, "R", 10)
    _post(db, "https://tiktok.com/1", 0)

    items = c.get("/api/feed").json()["items"]
    assert [i["type"] for i in items] == ["recipe", "external_post"]
    assert items[0]["recipe"] is not None and items[0]["post"] is None
    assert items[1]["post"] is not None and items[1]["recipe"] is None


def test_leere_db_liefert_leere_liste(ctx):
    c, _ = ctx
    daten = c.get("/api/feed").json()
    assert daten["items"] == []
    assert daten["next_cursor"] is None


# ── Sichtbarkeit ─────────────────────────────────────────────────────────────

def test_entwuerfe_tauchen_nicht_auf(ctx):
    c, db = ctx
    _rezept(db, "Sichtbar", 10)
    _rezept(db, "Entwurf", 20, status=RecipeStatus.draft)

    assert _titel(c.get("/api/feed").json()["items"]) == ["Sichtbar"]


def test_geloeschte_rezepte_tauchen_nicht_auf(ctx):
    c, db = ctx
    _rezept(db, "Sichtbar", 10)
    _rezept(db, "Papierkorb", 20, geloescht=BASIS)

    assert _titel(c.get("/api/feed").json()["items"]) == ["Sichtbar"]


def test_fremdes_nicht_freigegebenes_rezept_bleibt_verborgen(ctx):
    """Datenschutz: Koch/Küchenhilfe sieht published Fremdrezepte nur nach
    Freigabe. Ohne den Sichtbarkeits-Filter im Feed leakte jedes published
    Rezept in den globalen Stream (Gegenprobe: nach `free_for_all` erscheint es).
    """
    from app.models.access import RecipeAccess

    c, db = ctx
    _rezept(db, "Eigenes", 10)  # created_by=1 == angemeldete Köchin
    fremd = _rezept(db, "Fremd", 20)
    fremd.created_by = 99
    fremd.author_id = 99
    db.commit()

    # Ohne Freigabe: nur das eigene Rezept.
    assert _titel(c.get("/api/feed").json()["items"]) == ["Eigenes"]

    # Nach free_for_all-Freigabe taucht das fremde Rezept auf.
    db.add(RecipeAccess(
        recipe_id=fremd.id,
        access_type="free_for_all",
        created_by=99,
    ))
    db.commit()
    assert _titel(c.get("/api/feed").json()["items"]) == ["Fremd", "Eigenes"]


# ── Antwortform ──────────────────────────────────────────────────────────────

def test_post_traegt_oembed_html(ctx):
    """Ohne dieses Markup bliebe der TikTok-Player im Feed stumm (F3b-2a)."""
    c, db = ctx
    _post(db, "https://tiktok.com/1", 0)

    post = c.get("/api/feed").json()["items"][0]["post"]
    assert "tiktok-embed" in post["oembed_html"]


def test_post_bleibt_ohne_private_felder(ctx):
    """Der Feed zeigt die Fremdsicht — Caption und Zutaten des Autors nicht."""
    c, db = ctx
    _post(db, "https://tiktok.com/1", 0)

    post = c.get("/api/feed").json()["items"][0]["post"]
    assert set(post) == {"id", "platform", "url", "thumbnail_url", "author_name", "oembed_html"}


def test_rezept_traegt_listenfelder(ctx):
    c, db = ctx
    _rezept(db, "R", 0)

    rezept = c.get("/api/feed").json()["items"][0]["recipe"]
    for feld in ("id", "title", "primary_image", "rating_avg", "rating_count", "categories"):
        assert feld in rezept


# ── Cursor ───────────────────────────────────────────────────────────────────

def _alles_blaettern(c, limit):
    """Blättert bis zum Ende und gibt alle Items in Reihenfolge zurück."""
    alle, cursor, runden = [], None, 0
    while True:
        runden += 1
        assert runden < 50, "Cursor terminiert nicht"
        params = {"limit": limit}
        if cursor:
            params["before"] = cursor
        daten = c.get("/api/feed", params=params).json()
        alle.extend(daten["items"])
        cursor = daten["next_cursor"]
        if cursor is None:
            return alle


def test_blaettert_ohne_dubletten_und_luecken(ctx):
    c, db = ctx
    erwartet = []
    for n in range(9):
        erwartet.append(_rezept(db, f"R{n}", n * 10).title)
        erwartet.append(_post(db, f"https://tiktok.com/{n}", n * 10 + 5).url)
    erwartet.reverse()  # neueste zuerst

    assert _titel(_alles_blaettern(c, limit=4)) == erwartet


def test_gleicher_zeitstempel_geht_nicht_verloren(ctx):
    """Der Grund für den id-Tiebreaker: drei Items in derselben Sekunde.

    Mit reinem `created_at <` verschwänden zwei davon beim Blättern, mit
    `<=` erschiene eines doppelt.
    """
    c, db = ctx
    _rezept(db, "A", 0)
    _rezept(db, "B", 0)
    _post(db, "https://tiktok.com/1", 0)

    namen = _titel(_alles_blaettern(c, limit=1))
    assert sorted(namen) == ["A", "B", "https://tiktok.com/1"]


def test_letzte_seite_hat_keinen_cursor(ctx):
    c, db = ctx
    _rezept(db, "R", 0)

    assert c.get("/api/feed", params={"limit": 5}).json()["next_cursor"] is None


def test_kaputter_cursor_gibt_422(ctx):
    c, _ = ctx
    assert c.get("/api/feed", params={"before": "kein-datum"}).status_code == 422


def test_blanker_zeitstempel_als_cursor(ctx):
    """Kurzform fürs manuelle Testen: alles echt vor diesem Zeitpunkt."""
    c, db = ctx
    _rezept(db, "Frueh", 0)
    _rezept(db, "Spaet", 30)

    grenze = (BASIS + timedelta(minutes=30)).isoformat()
    assert _titel(c.get("/api/feed", params={"before": grenze}).json()["items"]) == ["Frueh"]


# ── Kraut des Monats ─────────────────────────────────────────────────────────

KRAUT = SpotlightPick(
    spotlight=PlantSpotlight(
        period_key="2026-07",
        slug="salbei",
        deutscher_name="Salbei",
        botanischer_name="Salvia officinalis",
        teaser="Würzt Butter und Saltimbocca.",
    ),
    created_at=BASIS + timedelta(minutes=15),
)


def test_kraut_erscheint_einmal_und_an_der_richtigen_stelle(ctx):
    c, db = ctx
    _rezept(db, "Alt", 0)
    _rezept(db, "Neu", 30)

    with patch("app.feed.router.resolve_spotlight", return_value=KRAUT):
        items = c.get("/api/feed").json()["items"]

    assert _titel(items) == ["Neu", "kraut:salbei", "Alt"]
    assert sum(1 for i in items if i["type"] == "spotlight") == 1


def test_kraut_erscheint_beim_blaettern_nicht_doppelt(ctx):
    c, db = ctx
    for n in range(5):
        _rezept(db, f"R{n}", n * 10)

    with patch("app.feed.router.resolve_spotlight", return_value=KRAUT):
        namen = _titel(_alles_blaettern(c, limit=2))

    assert namen.count("kraut:salbei") == 1
    assert len(namen) == 6


def test_feed_bleibt_ohne_kraut_bedienbar(ctx):
    """Kein Pflanzen-Zugriff oder kein Kandidat — der Feed trägt den Rest."""
    c, db = ctx
    _rezept(db, "R", 0)

    with patch("app.feed.router.resolve_spotlight", return_value=None):
        assert _titel(c.get("/api/feed").json()["items"]) == ["R"]

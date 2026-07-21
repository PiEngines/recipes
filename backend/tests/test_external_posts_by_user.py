"""Fremdsicht auf verlinkte Beiträge (F3b-2a · Commit 1).

`GET /api/users/{id}/external-posts` — die Quelle für den „Beiträge"-Tab des
öffentlichen Profils. Kein Netzwerk: `fetch_oembed` ist gemockt.
"""
from datetime import datetime
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import require_koch_or_above
from app.database import get_db
from app.external_posts.oembed import OEmbedError, OEmbedResult
from app.external_posts.router import router as posts_router
from app.external_posts.router import users_router as posts_users_router
from app.models import ExternalPost
from app.models.user import UserRole
from tests.dbfixtures import make_session_factory, make_user

INSTA = "https://www.instagram.com/reel/ABC123/"
TIKTOK = "https://www.tiktok.com/@koch/video/12345"

TIKTOK_ERGEBNIS = OEmbedResult(
    html="<blockquote class='tiktok-embed'></blockquote>",
    thumbnail_url="https://p16.tiktokcdn.com/thumb.jpg",
    author_name="koch",
    caption_text="200 g Feta\n2 Karotten",
)


@pytest.fixture
def ctx():
    Session = make_session_factory()
    db = Session()
    users = {
        "ich": make_user(db, 1, "ich", UserRole.koch),
        "fremd": make_user(db, 2, "fremd", UserRole.koch),
        "leer": make_user(db, 3, "leer", UserRole.koch),
        "weg": make_user(db, 4, "weg", UserRole.koch),
    }
    users["weg"].deleted_at = datetime(2026, 1, 1)
    db.commit()

    aktuell = {"u": users["ich"]}
    app = FastAPI()
    app.include_router(posts_router)
    app.include_router(posts_users_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_koch_or_above] = lambda: aktuell["u"]

    def als(name):
        aktuell["u"] = users[name]

    yield TestClient(app), db, als
    db.close()


def _anlegen(c, platform, url, ergebnis=TIKTOK_ERGEBNIS):
    with patch("app.external_posts.router.fetch_oembed", return_value=ergebnis):
        return c.post("/api/external-posts", json={"platform": platform, "url": url}).json()


def test_liefert_posts_des_anderen_users(ctx):
    c, _, als = ctx
    als("fremd")
    _anlegen(c, "tiktok", TIKTOK)
    _anlegen(c, "instagram", INSTA)

    als("ich")
    r = c.get("/api/users/2/external-posts")
    assert r.status_code == 200
    assert {p["url"] for p in r.json()} == {TIKTOK, INSTA}


def test_zeigt_nur_die_des_gefragten_users(ctx):
    c, _, als = ctx
    _anlegen(c, "tiktok", TIKTOK)          # gehört „ich"
    als("fremd")
    _anlegen(c, "instagram", INSTA)        # gehört „fremd"

    als("ich")
    fremde = c.get("/api/users/2/external-posts").json()
    assert [p["url"] for p in fremde] == [INSTA]


def test_neueste_zuerst(ctx):
    c, db, _ = ctx
    erst = _anlegen(c, "tiktok", TIKTOK)["id"]
    spaeter = _anlegen(c, "instagram", INSTA)["id"]
    # created_at ist server_default — in SQLite je nach Auflösung identisch.
    # Die Sortierung fällt dann auf die ID zurück, genau dafür der zweite Key.
    assert [p["id"] for p in c.get("/api/users/1/external-posts").json()] == [spaeter, erst]


def test_user_ohne_posts_liefert_leere_liste(ctx):
    c, _, _ = ctx
    r = c.get("/api/users/3/external-posts")
    assert r.status_code == 200
    assert r.json() == []


def test_unbekannter_user_404(ctx):
    c, _, _ = ctx
    assert c.get("/api/users/9999/external-posts").status_code == 404


def test_geloeschter_user_404(ctx):
    c, _, _ = ctx
    assert c.get("/api/users/4/external-posts").status_code == 404


# ── Antwortform ──────────────────────────────────────────────────────────────

def test_keine_privaten_felder(ctx):
    """Caption, Zutaten und Rezept-Verknüpfung sind die private Arbeitsfläche
    des Autors — sie dürfen in der Fremdsicht nicht auftauchen."""
    c, _, _ = ctx
    _anlegen(c, "tiktok", TIKTOK)

    post = c.get("/api/users/1/external-posts").json()[0]
    assert set(post) == {"id", "platform", "url", "thumbnail_url", "author_name", "oembed_html"}
    for privat in ("caption_text", "extracted_ingredients", "recipe_id", "created_by"):
        assert privat not in post


def test_oembed_html_ist_dabei(ctx):
    """Ohne oembed_html bliebe ein TikTok-Beitrag auf fremden Profilen stumm —
    der Player entsteht erst aus diesem Markup."""
    c, _, _ = ctx
    _anlegen(c, "tiktok", TIKTOK)

    post = c.get("/api/users/1/external-posts").json()[0]
    assert "tiktok-embed" in post["oembed_html"]


def test_post_ohne_oembed_bleibt_enthalten(ctx):
    """Scheiterte die Anreicherung, ist der Beitrag trotzdem sichtbar — im
    Frontend greift dann der Thumbnail-Fallback."""
    c, _, _ = ctx
    with patch("app.external_posts.router.fetch_oembed", side_effect=OEmbedError("x")):
        c.post("/api/external-posts", json={"platform": "tiktok", "url": TIKTOK})

    posts = c.get("/api/users/1/external-posts").json()
    assert len(posts) == 1
    assert posts[0]["oembed_html"] is None


def test_eigene_liste_bleibt_unveraendert(ctx):
    """Vertrag: /api/external-posts liefert weiter die kompakte Form ohne
    oembed_html — die Sammlungen hängen daran."""
    c, _, _ = ctx
    _anlegen(c, "tiktok", TIKTOK)

    item = c.get("/api/external-posts").json()[0]
    assert set(item) == {"id", "platform", "url", "thumbnail_url", "author_name"}

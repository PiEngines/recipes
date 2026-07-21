"""Tests für External Posts — Persistenz, Host-Validierung, Sichtbarkeit.

Angelegt in F3a (Commit 3). Seit F3b-1 reichert das Anlegen den Beitrag per
oEmbed an; die Anreicherung selbst prüft `test_external_posts_oembed.py`. Hier
wird sie durchgängig als *fehlgeschlagen* gemockt — das hält diese Suite auf
ihrem Thema und stellt zugleich sicher, dass kein Test ins Netz geht.
"""
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import require_koch_or_above
from app.database import get_db
from app.external_posts.oembed import OEmbedError
from app.external_posts.router import router as posts_router
from app.models import ExternalPost
from app.models.user import UserRole
from tests.dbfixtures import make_session_factory, make_user

INSTA = "https://www.instagram.com/p/ABC123/"
TIKTOK = "https://www.tiktok.com/@koch/video/12345"


@pytest.fixture(autouse=True)
def kein_netz():
    """Sicherheitsnetz: kein Test dieser Datei darf oEmbed wirklich aufrufen."""
    with patch(
        "app.external_posts.router.fetch_oembed",
        side_effect=OEmbedError("in Tests nicht abgerufen"),
    ):
        yield


@pytest.fixture
def ctx():
    Session = make_session_factory()
    db = Session()
    users = {
        "ich": make_user(db, 1, "ich", UserRole.koch),
        "fremd": make_user(db, 2, "fremd", UserRole.koch),
    }
    db.commit()

    aktuell = {"u": users["ich"]}
    app = FastAPI()
    app.include_router(posts_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_koch_or_above] = lambda: aktuell["u"]

    def als(name):
        aktuell["u"] = users[name]

    yield TestClient(app), db, als
    db.close()


# ── Anlegen ──────────────────────────────────────────────────────────────────

def test_instagram_post_anlegen(ctx):
    c, _, _ = ctx
    r = c.post("/api/external-posts", json={"platform": "instagram", "url": INSTA})
    assert r.status_code == 201
    assert r.json()["platform"] == "instagram"
    assert r.json()["url"] == INSTA
    assert r.json()["created_by"] == 1


def test_tiktok_post_anlegen(ctx):
    c, _, _ = ctx
    assert c.post("/api/external-posts", json={"platform": "tiktok", "url": TIKTOK}).status_code == 201


def test_ableitungsfelder_bleiben_bei_oembed_fehler_leer(ctx):
    """Schlägt die Anreicherung fehl, bleibt der Beitrag trotzdem gespeichert —
    mit leeren Cache-Feldern, nachziehbar per `/refresh`."""
    c, db, _ = ctx
    c.post("/api/external-posts", json={"platform": "instagram", "url": INSTA})
    post = db.query(ExternalPost).first()
    assert post.oembed_html is None
    assert post.thumbnail_url is None
    assert post.author_name is None
    assert post.caption_text is None
    assert post.extracted_ingredients is None


@pytest.mark.parametrize("url", [
    "https://instagram.com/p/X/",
    "https://www.instagram.com/reel/X/",
    "https://instagr.am/p/X/",
    "https://m.instagram.com/p/X/",
])
def test_instagram_hostvarianten_akzeptiert(ctx, url):
    c, _, _ = ctx
    assert c.post("/api/external-posts", json={"platform": "instagram", "url": url}).status_code == 201


@pytest.mark.parametrize("url", [
    "https://www.tiktok.com/@a/video/1",
    "https://tiktok.com/@a/video/1",
    "https://vm.tiktok.com/ABC/",
])
def test_tiktok_hostvarianten_akzeptiert(ctx, url):
    c, _, _ = ctx
    assert c.post("/api/external-posts", json={"platform": "tiktok", "url": url}).status_code == 201


@pytest.mark.parametrize("platform,url", [
    ("instagram", TIKTOK),                              # Plattform/Host vertauscht
    ("tiktok", INSTA),
    ("instagram", "https://example.com/p/X/"),          # fremder Host
    ("instagram", "https://instagram.com.angreifer.tld/p/X/"),  # Suffix-Trick
    ("instagram", "https://nichtinstagram.com/p/X/"),   # Teilstring-Trick
    ("tiktok", "https://tiktok.com.evil.tld/@a/1"),
])
def test_falscher_host_400(ctx, platform, url):
    c, _, _ = ctx
    assert c.post("/api/external-posts", json={"platform": platform, "url": url}).status_code == 400


@pytest.mark.parametrize("url", [
    "javascript:alert(1)",
    "ftp://instagram.com/p/X/",
    "instagram.com/p/X/",        # ohne Schema
    "",
])
def test_ungueltiges_schema_abgelehnt(ctx, url):
    c, _, _ = ctx
    assert c.post("/api/external-posts", json={"platform": "instagram", "url": url}).status_code in (400, 422)


def test_unbekannte_plattform_422(ctx):
    c, _, _ = ctx
    r = c.post("/api/external-posts", json={"platform": "youtube", "url": "https://youtube.com/x"})
    assert r.status_code == 422


# ── Lesen ────────────────────────────────────────────────────────────────────

def test_liste_zeigt_nur_eigene(ctx):
    c, _, als = ctx
    c.post("/api/external-posts", json={"platform": "instagram", "url": INSTA})
    als("fremd")
    c.post("/api/external-posts", json={"platform": "tiktok", "url": TIKTOK})

    assert len(c.get("/api/external-posts").json()) == 1
    als("ich")
    meine = c.get("/api/external-posts").json()
    assert len(meine) == 1
    assert meine[0]["url"] == INSTA


def test_liste_ist_kompakt(ctx):
    c, _, _ = ctx
    c.post("/api/external-posts", json={"platform": "instagram", "url": INSTA})
    item = c.get("/api/external-posts").json()[0]
    assert set(item) == {"id", "platform", "url", "thumbnail_url", "author_name"}


def test_einzelabruf(ctx):
    c, _, _ = ctx
    pid = c.post("/api/external-posts", json={"platform": "instagram", "url": INSTA}).json()["id"]
    assert c.get(f"/api/external-posts/{pid}").json()["url"] == INSTA


def test_unbekannter_post_404(ctx):
    c, _, _ = ctx
    assert c.get("/api/external-posts/9999").status_code == 404


# ── Löschen ──────────────────────────────────────────────────────────────────

def test_owner_darf_loeschen(ctx):
    c, db, _ = ctx
    pid = c.post("/api/external-posts", json={"platform": "instagram", "url": INSTA}).json()["id"]
    assert c.delete(f"/api/external-posts/{pid}").status_code == 204
    assert db.query(ExternalPost).count() == 0


def test_fremder_darf_nicht_loeschen(ctx):
    c, db, als = ctx
    pid = c.post("/api/external-posts", json={"platform": "instagram", "url": INSTA}).json()["id"]
    als("fremd")
    assert c.delete(f"/api/external-posts/{pid}").status_code == 403
    assert db.query(ExternalPost).count() == 1


def test_loeschen_unbekannt_404(ctx):
    c, _, _ = ctx
    assert c.delete("/api/external-posts/9999").status_code == 404

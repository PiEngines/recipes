"""Tests für den oEmbed-Abruf (F3b-1 · Commit 1).

Kein Test hier geht ins Netz: der Abruf ist entweder auf `httpx.Client`-Ebene
(Modultests von `fetch_oembed`) oder auf Router-Ebene (`fetch_oembed` selbst)
gemockt.
"""
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import require_koch_or_above
from app.database import get_db
from app.external_posts.oembed import OEmbedError, OEmbedResult, fetch_oembed
from app.external_posts.router import router as posts_router
from app.models import ExternalPlatform, ExternalPost
from app.models.user import UserRole
from tests.dbfixtures import make_session_factory, make_user

INSTA = "https://www.instagram.com/reel/ABC123/"
TIKTOK = "https://www.tiktok.com/@koch/video/12345"

# Antwortformen der beiden Plattformen, gekürzt auf das, was wir auswerten.
TIKTOK_ANTWORT = {
    "html": '<blockquote class="tiktok-embed" cite="…"></blockquote>',
    "thumbnail_url": "https://p16.tiktokcdn.com/thumb.jpg",
    "author_name": "koch",
    "title": "Ofengemüse\n2 Karotten\n1 Zucchini",
}
INSTA_ANTWORT = {
    "html": '<blockquote class="instagram-media" data-instgrm-permalink="…"></blockquote>',
    "thumbnail_url": "https://scontent.cdninstagram.com/thumb.jpg",
    "author_name": "kochstudio",
    # Instagram liefert per oEmbed keine Caption — der Schlüssel fehlt schlicht.
}


# ── fetch_oembed: HTTP-Ebene gemockt ─────────────────────────────────────────

def _fake_client(json_daten=None, fehler=None):
    """Ersatz für `httpx.Client` als Context-Manager."""
    response = MagicMock()
    if fehler is not None:
        response.raise_for_status.side_effect = fehler
    else:
        response.raise_for_status.return_value = None
        response.json.return_value = json_daten

    client = MagicMock()
    client.get.return_value = response
    client.__enter__.return_value = client
    client.__exit__.return_value = False
    return client, client.get


def test_tiktok_liefert_caption_aus_title():
    client, _ = _fake_client(TIKTOK_ANTWORT)
    with patch("app.external_posts.oembed.httpx.Client", return_value=client):
        ergebnis = fetch_oembed(ExternalPlatform.tiktok, TIKTOK)

    assert ergebnis.caption_text == "Ofengemüse\n2 Karotten\n1 Zucchini"
    assert ergebnis.author_name == "koch"
    assert ergebnis.thumbnail_url == TIKTOK_ANTWORT["thumbnail_url"]
    assert "tiktok-embed" in ergebnis.html


def test_instagram_hat_keine_caption():
    """Vertrag: Insta-Captions kommen ausschliesslich manuell (Commit 2)."""
    client, _ = _fake_client(INSTA_ANTWORT)
    with patch("app.external_posts.oembed.httpx.Client", return_value=client):
        ergebnis = fetch_oembed(ExternalPlatform.instagram, INSTA)

    assert ergebnis.caption_text is None
    assert "instagram-media" in ergebnis.html
    assert ergebnis.thumbnail_url == INSTA_ANTWORT["thumbnail_url"]


def test_instagram_title_wird_nicht_als_caption_uebernommen():
    """Auch wenn Meta irgendwann ein `title` mitschickt: das ist keine Caption."""
    client, _ = _fake_client({**INSTA_ANTWORT, "title": "Irgendein Titel"})
    with patch("app.external_posts.oembed.httpx.Client", return_value=client):
        assert fetch_oembed(ExternalPlatform.instagram, INSTA).caption_text is None


def test_endpunkte_und_parameter():
    """Tokenlos abrufen — und bei Insta ohne Embed-Skript im HTML."""
    client, get = _fake_client(INSTA_ANTWORT)
    with patch("app.external_posts.oembed.httpx.Client", return_value=client):
        fetch_oembed(ExternalPlatform.instagram, INSTA)

    url, kwargs = get.call_args[0][0], get.call_args[1]
    assert url == "https://graph.facebook.com/v25.0/instagram_oembed"
    assert kwargs["params"] == {"url": INSTA, "omitscript": "true"}
    assert "access_token" not in kwargs["params"]

    client, get = _fake_client(TIKTOK_ANTWORT)
    with patch("app.external_posts.oembed.httpx.Client", return_value=client):
        fetch_oembed(ExternalPlatform.tiktok, TIKTOK)

    assert get.call_args[0][0] == "https://www.tiktok.com/oembed"
    assert get.call_args[1]["params"] == {"url": TIKTOK}


@pytest.mark.parametrize("fehler", [
    httpx.TimeoutException("timeout"),
    httpx.ConnectError("kein Netz"),
    httpx.HTTPStatusError("404", request=MagicMock(), response=MagicMock()),
])
def test_netzwerkfehler_wird_zu_oembed_error(fehler):
    client, _ = _fake_client(fehler=fehler)
    with patch("app.external_posts.oembed.httpx.Client", return_value=client):
        with pytest.raises(OEmbedError):
            fetch_oembed(ExternalPlatform.tiktok, TIKTOK)


def test_kaputtes_json_wird_zu_oembed_error():
    client, _ = _fake_client()
    client.get.return_value.json.side_effect = ValueError("kein JSON")
    with patch("app.external_posts.oembed.httpx.Client", return_value=client):
        with pytest.raises(OEmbedError):
            fetch_oembed(ExternalPlatform.tiktok, TIKTOK)


def test_unerwartete_antwortform_wird_zu_oembed_error():
    client, _ = _fake_client(["kein", "dict"])
    with patch("app.external_posts.oembed.httpx.Client", return_value=client):
        with pytest.raises(OEmbedError):
            fetch_oembed(ExternalPlatform.tiktok, TIKTOK)


def test_zu_lange_felder_werden_gekappt():
    """Spaltenbreiten dürfen nicht von fremden Antworten gesprengt werden."""
    client, _ = _fake_client({
        "html": "<b>x</b>",
        "thumbnail_url": "https://x.de/" + "a" * 2000,
        "author_name": "n" * 500,
    })
    with patch("app.external_posts.oembed.httpx.Client", return_value=client):
        ergebnis = fetch_oembed(ExternalPlatform.tiktok, TIKTOK)

    assert len(ergebnis.thumbnail_url) == 1000
    assert len(ergebnis.author_name) == 255


# ── Router: fetch_oembed gemockt ─────────────────────────────────────────────

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


TIKTOK_ERGEBNIS = OEmbedResult(
    html=TIKTOK_ANTWORT["html"],
    thumbnail_url=TIKTOK_ANTWORT["thumbnail_url"],
    author_name="koch",
    caption_text=TIKTOK_ANTWORT["title"],
)
INSTA_ERGEBNIS = OEmbedResult(
    html=INSTA_ANTWORT["html"],
    thumbnail_url=INSTA_ANTWORT["thumbnail_url"],
    author_name="kochstudio",
    caption_text=None,
)


def _mit_oembed(ergebnis):
    return patch("app.external_posts.router.fetch_oembed", return_value=ergebnis)


def _ohne_oembed():
    return patch(
        "app.external_posts.router.fetch_oembed",
        side_effect=OEmbedError("Netzwerk"),
    )


def test_anlegen_reichert_tiktok_an(ctx):
    c, _, _ = ctx
    with _mit_oembed(TIKTOK_ERGEBNIS):
        body = c.post("/api/external-posts", json={"platform": "tiktok", "url": TIKTOK}).json()

    assert body["caption_text"] == TIKTOK_ANTWORT["title"]
    assert body["author_name"] == "koch"
    assert body["thumbnail_url"] == TIKTOK_ANTWORT["thumbnail_url"]
    assert "tiktok-embed" in body["oembed_html"]


def test_anlegen_reichert_instagram_ohne_caption_an(ctx):
    c, _, _ = ctx
    with _mit_oembed(INSTA_ERGEBNIS):
        body = c.post("/api/external-posts", json={"platform": "instagram", "url": INSTA}).json()

    assert body["caption_text"] is None
    assert "instagram-media" in body["oembed_html"]
    assert body["thumbnail_url"] == INSTA_ANTWORT["thumbnail_url"]


def test_oembed_fehler_verhindert_speichern_nicht(ctx):
    """Kernvertrag: ein toter oEmbed-Endpunkt kostet den Link nicht."""
    c, db, _ = ctx
    with _ohne_oembed():
        r = c.post("/api/external-posts", json={"platform": "tiktok", "url": TIKTOK})

    assert r.status_code == 201
    post = db.query(ExternalPost).one()
    assert post.url == TIKTOK
    assert post.oembed_html is None
    assert post.thumbnail_url is None
    assert post.author_name is None
    assert post.caption_text is None


# ── /preview ─────────────────────────────────────────────────────────────────

def test_preview_legt_nichts_an(ctx):
    c, db, _ = ctx
    with _mit_oembed(TIKTOK_ERGEBNIS):
        r = c.post("/api/external-posts/preview", json={"platform": "tiktok", "url": TIKTOK})

    assert r.status_code == 200
    assert r.json()["author_name"] == "koch"
    assert r.json()["caption_text"] == TIKTOK_ANTWORT["title"]
    assert db.query(ExternalPost).count() == 0


def test_preview_ohne_id_und_created_at(ctx):
    c, _, _ = ctx
    with _mit_oembed(TIKTOK_ERGEBNIS):
        body = c.post("/api/external-posts/preview", json={"platform": "tiktok", "url": TIKTOK}).json()

    assert set(body) == {
        "platform", "url", "oembed_html", "thumbnail_url", "author_name", "caption_text",
    }


def test_preview_bei_oembed_fehler_502(ctx):
    c, db, _ = ctx
    with _ohne_oembed():
        r = c.post("/api/external-posts/preview", json={"platform": "tiktok", "url": TIKTOK})

    assert r.status_code == 502
    assert db.query(ExternalPost).count() == 0


def test_preview_prueft_host(ctx):
    """Host-Validierung vor dem Abruf — sonst wäre /preview ein offener Proxy."""
    c, _, _ = ctx
    with _mit_oembed(TIKTOK_ERGEBNIS) as gemockt:
        r = c.post(
            "/api/external-posts/preview",
            json={"platform": "tiktok", "url": "https://evil.tld/@a/1"},
        )

    assert r.status_code == 400
    gemockt.assert_not_called()


# ── /refresh ─────────────────────────────────────────────────────────────────

def test_refresh_zieht_felder_nach(ctx):
    c, db, _ = ctx
    with _ohne_oembed():
        pid = c.post("/api/external-posts", json={"platform": "tiktok", "url": TIKTOK}).json()["id"]

    with _mit_oembed(TIKTOK_ERGEBNIS):
        r = c.post(f"/api/external-posts/{pid}/refresh")

    assert r.status_code == 200
    assert r.json()["author_name"] == "koch"
    assert db.query(ExternalPost).one().oembed_html is not None


def test_refresh_ueberschreibt_manuelle_caption_nicht(ctx):
    """Instagram liefert nie eine Caption — ein Refresh darf die manuell
    eingefügte Beschreibung deshalb nicht wegräumen."""
    c, db, _ = ctx
    with _mit_oembed(INSTA_ERGEBNIS):
        pid = c.post("/api/external-posts", json={"platform": "instagram", "url": INSTA}).json()["id"]

    post = db.query(ExternalPost).one()
    post.caption_text = "2 Karotten\n1 Zucchini"
    db.commit()

    with _mit_oembed(INSTA_ERGEBNIS):
        r = c.post(f"/api/external-posts/{pid}/refresh")

    assert r.status_code == 200
    assert r.json()["caption_text"] == "2 Karotten\n1 Zucchini"


def test_refresh_nur_owner(ctx):
    c, _, als = ctx
    with _ohne_oembed():
        pid = c.post("/api/external-posts", json={"platform": "tiktok", "url": TIKTOK}).json()["id"]

    als("fremd")
    with _mit_oembed(TIKTOK_ERGEBNIS):
        assert c.post(f"/api/external-posts/{pid}/refresh").status_code == 403


def test_refresh_bei_oembed_fehler_502(ctx):
    c, _, _ = ctx
    with _ohne_oembed():
        pid = c.post("/api/external-posts", json={"platform": "tiktok", "url": TIKTOK}).json()["id"]
        assert c.post(f"/api/external-posts/{pid}/refresh").status_code == 502


def test_refresh_unbekannt_404(ctx):
    c, _, _ = ctx
    with _mit_oembed(TIKTOK_ERGEBNIS):
        assert c.post("/api/external-posts/9999/refresh").status_code == 404

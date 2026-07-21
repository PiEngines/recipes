"""Tests für Zutaten-Extraktion, Bearbeiten und Einkaufsliste (F3b-1 · Commit 2).

Kein Netzwerk: `fetch_oembed` ist durchgängig gemockt.
"""
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user, require_koch_or_above
from app.database import get_db
from app.external_posts.extract import extract_ingredients
from app.external_posts.oembed import OEmbedError, OEmbedResult
from app.external_posts.router import router as posts_router
from app.models import ExternalPost, ShoppingListItem
from app.models.user import UserRole
from app.shopping.router import router as shopping_router
from tests.dbfixtures import make_session_factory, make_user

INSTA = "https://www.instagram.com/reel/ABC123/"
TIKTOK = "https://www.tiktok.com/@koch/video/12345"

TIKTOK_CAPTION = (
    "Ofengemüse mit Feta 🔥\n"
    "Zutaten:\n"
    "- 2 Karotten\n"
    "- 200 g Feta\n"
    "- ½ TL Salz\n"
    "- 1 1/2 EL Olivenöl\n"
    "- Pfeffer\n"
    "#rezept #vegetarisch"
)


# ── Parser (reine Funktion) ──────────────────────────────────────────────────

def _nach_name(zutaten):
    return {z["name"]: z for z in zutaten}


def test_caption_wird_zerlegt():
    nach_name = _nach_name(extract_ingredients(TIKTOK_CAPTION))

    assert nach_name["Karotten"]["amount"] == "2"
    assert nach_name["Karotten"]["unit"] is None

    assert nach_name["Feta"]["amount"] == "200"
    assert nach_name["Feta"]["unit"] == "g"

    assert nach_name["Salz"]["amount"] == "½"
    assert nach_name["Salz"]["unit"] == "TL"

    assert nach_name["Olivenöl"]["amount"] == "1 1/2"
    assert nach_name["Olivenöl"]["unit"] == "EL"

    # Zutat ohne Menge bleibt erhalten — „Pfeffer" ist eine gültige Position.
    assert nach_name["Pfeffer"]["amount"] is None


def test_ueberschrift_und_hashtags_fliegen_raus():
    namen = [z["name"] for z in extract_ingredients(TIKTOK_CAPTION)]
    assert "Zutaten:" not in namen
    assert not any("#" in n for n in namen)
    assert not any(n.startswith("-") for n in namen)


def test_raw_bleibt_erhalten():
    """`raw` macht nachvollziehbar, woraus eine Position entstand."""
    nach_name = _nach_name(extract_ingredients(TIKTOK_CAPTION))
    assert nach_name["Feta"]["raw"] == "200 g Feta"


@pytest.mark.parametrize("zeile,amount,unit,name", [
    ("2 Karotten", "2", None, "Karotten"),
    ("200 g Feta", "200", "g", "Feta"),
    ("1 Prise Salz", "1", "Prise", "Salz"),
    ("½ Zwiebel", "½", None, "Zwiebel"),
    ("2-3 Tomaten", "2-3", None, "Tomaten"),
    ("1,5 l Wasser", "1,5", "l", "Wasser"),
    ("3 Zehen Knoblauch", "3", "Zehen", "Knoblauch"),
    ("2 EL. Zucker", "2", "EL", "Zucker"),
    ("Salz", None, None, "Salz"),
])
def test_einzelzeilen(zeile, amount, unit, name):
    zutat = extract_ingredients(zeile)[0]
    assert (zutat["amount"], zutat["unit"], zutat["name"]) == (amount, unit, name)


@pytest.mark.parametrize("caption", [
    None,
    "",
    "   \n\n  ",
    "#nurhashtags #undsonstnichts",
    "https://example.com/rezept",
    "Zutaten:",
])
def test_nichts_zu_holen(caption):
    assert extract_ingredients(caption) == []


def test_fliesstext_wird_verworfen():
    lang = (
        "Das hier ist ein langer Fliesstext ueber meine Kindheit und wie meine "
        "Oma dieses Gericht immer gekocht hat, mit ganz viel Liebe."
    )
    assert extract_ingredients(lang) == []


@pytest.mark.parametrize("zeile", ["4", "200 g", "1/2"])
def test_zeile_ohne_zutatennamen_faellt_weg(zeile):
    """Menge ohne Name ist keine Position — der Buchstaben-Filter greift."""
    assert extract_ingredients(zeile) == []


# ── Router ───────────────────────────────────────────────────────────────────

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
    app.include_router(shopping_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_koch_or_above] = lambda: aktuell["u"]
    app.dependency_overrides[get_current_user] = lambda: aktuell["u"]

    def als(name):
        aktuell["u"] = users[name]

    yield TestClient(app), db, als
    db.close()


TIKTOK_ERGEBNIS = OEmbedResult(
    html="<blockquote class='tiktok-embed'></blockquote>",
    thumbnail_url="https://p16.tiktokcdn.com/thumb.jpg",
    author_name="koch",
    caption_text=TIKTOK_CAPTION,
)
INSTA_ERGEBNIS = OEmbedResult(
    html="<blockquote class='instagram-media'></blockquote>",
    thumbnail_url="https://scontent.cdninstagram.com/thumb.jpg",
    author_name="kochstudio",
    caption_text=None,
)


def _anlegen(c, platform, url, ergebnis):
    with patch("app.external_posts.router.fetch_oembed", return_value=ergebnis):
        return c.post("/api/external-posts", json={"platform": platform, "url": url}).json()


def test_tiktok_zutaten_beim_anlegen(ctx):
    """TikTok liefert die Caption — die Extraktion läuft automatisch mit."""
    c, _, _ = ctx
    body = _anlegen(c, "tiktok", TIKTOK, TIKTOK_ERGEBNIS)

    namen = [z["name"] for z in body["extracted_ingredients"]]
    assert "Feta" in namen and "Karotten" in namen


def test_instagram_hat_zunaechst_keine_zutaten(ctx):
    c, _, _ = ctx
    body = _anlegen(c, "instagram", INSTA, INSTA_ERGEBNIS)
    assert body["caption_text"] is None
    assert body["extracted_ingredients"] in (None, [])


def test_instagram_caption_nachtragen_parst(ctx):
    """Der Insta-Hauptfall: Beschreibung von Hand einfügen."""
    c, _, _ = ctx
    pid = _anlegen(c, "instagram", INSTA, INSTA_ERGEBNIS)["id"]

    r = c.patch(f"/api/external-posts/{pid}", json={"caption_text": "200 g Feta\n2 Karotten"})
    assert r.status_code == 200
    assert r.json()["caption_text"] == "200 g Feta\n2 Karotten"
    assert _nach_name(r.json()["extracted_ingredients"])["Feta"]["unit"] == "g"


def test_manuelle_liste_gewinnt(ctx):
    """Handkorrektur darf nicht vom Parser überschrieben werden."""
    c, _, _ = ctx
    pid = _anlegen(c, "tiktok", TIKTOK, TIKTOK_ERGEBNIS)["id"]

    korrigiert = [{"name": "Schafskäse", "amount": "250", "unit": "g", "raw": "200 g Feta"}]
    r = c.patch(f"/api/external-posts/{pid}", json={"extracted_ingredients": korrigiert})

    assert r.status_code == 200
    liste = r.json()["extracted_ingredients"]
    assert len(liste) == 1
    assert liste[0]["name"] == "Schafskäse"
    assert liste[0]["amount"] == "250"


def test_manuelle_liste_gewinnt_auch_neben_caption(ctx):
    """Kommen beide Felder zusammen, gewinnt die Liste — kein Re-Parse."""
    c, _, _ = ctx
    pid = _anlegen(c, "instagram", INSTA, INSTA_ERGEBNIS)["id"]

    r = c.patch(f"/api/external-posts/{pid}", json={
        "caption_text": "200 g Feta\n2 Karotten",
        "extracted_ingredients": [{"name": "Nur das hier"}],
    })

    assert r.json()["caption_text"] == "200 g Feta\n2 Karotten"
    assert [z["name"] for z in r.json()["extracted_ingredients"]] == ["Nur das hier"]


def test_patch_ohne_felder_aendert_nichts(ctx):
    c, _, _ = ctx
    vorher = _anlegen(c, "tiktok", TIKTOK, TIKTOK_ERGEBNIS)
    nachher = c.patch(f"/api/external-posts/{vorher['id']}", json={}).json()
    assert nachher["extracted_ingredients"] == vorher["extracted_ingredients"]
    assert nachher["caption_text"] == vorher["caption_text"]


def test_caption_loeschen_leert_zutaten(ctx):
    c, _, _ = ctx
    pid = _anlegen(c, "tiktok", TIKTOK, TIKTOK_ERGEBNIS)["id"]
    r = c.patch(f"/api/external-posts/{pid}", json={"caption_text": None})
    assert r.json()["caption_text"] is None
    assert r.json()["extracted_ingredients"] == []


def test_patch_nur_owner(ctx):
    c, _, als = ctx
    pid = _anlegen(c, "tiktok", TIKTOK, TIKTOK_ERGEBNIS)["id"]
    als("fremd")
    assert c.patch(f"/api/external-posts/{pid}", json={"caption_text": "x"}).status_code == 403


def test_patch_unbekannt_404(ctx):
    c, _, _ = ctx
    assert c.patch("/api/external-posts/9999", json={"caption_text": "x"}).status_code == 404


def test_patch_lehnt_zutat_ohne_namen_ab(ctx):
    c, _, _ = ctx
    pid = _anlegen(c, "tiktok", TIKTOK, TIKTOK_ERGEBNIS)["id"]
    r = c.patch(f"/api/external-posts/{pid}", json={"extracted_ingredients": [{"name": ""}]})
    assert r.status_code == 422


def test_refresh_behaelt_handkorrektur_bei_gleicher_caption(ctx):
    """Ein Refresh holt dasselbe zurück — die korrigierte Liste muss stehen
    bleiben, sonst ist jede Handarbeit einen Klick später weg."""
    c, _, _ = ctx
    pid = _anlegen(c, "tiktok", TIKTOK, TIKTOK_ERGEBNIS)["id"]
    c.patch(f"/api/external-posts/{pid}", json={"extracted_ingredients": [{"name": "Schafskäse"}]})

    with patch("app.external_posts.router.fetch_oembed", return_value=TIKTOK_ERGEBNIS):
        r = c.post(f"/api/external-posts/{pid}/refresh")

    assert [z["name"] for z in r.json()["extracted_ingredients"]] == ["Schafskäse"]


# ── → Einkaufsliste ──────────────────────────────────────────────────────────

def test_zutaten_auf_einkaufsliste(ctx):
    c, db, _ = ctx
    pid = _anlegen(c, "tiktok", TIKTOK, TIKTOK_ERGEBNIS)["id"]

    r = c.post(f"/api/external-posts/{pid}/to-shopping-list")
    assert r.status_code == 201

    items = db.query(ShoppingListItem).all()
    assert r.json()["created"] == len(items) > 0

    feta = next(i for i in items if i.name == "Feta")
    assert feta.amount == "200"
    assert feta.unit == "g"
    # Manuelle Position: die Einkaufsliste kennt keine externen Beiträge.
    assert feta.recipe_id is None
    assert feta.recipe_title == "koch · TikTok"


def test_label_ohne_autor(ctx):
    c, db, _ = ctx
    ohne_autor = OEmbedResult(html="<b>x</b>", caption_text="200 g Feta")
    pid = _anlegen(c, "tiktok", TIKTOK, ohne_autor)["id"]

    c.post(f"/api/external-posts/{pid}/to-shopping-list")
    assert db.query(ShoppingListItem).first().recipe_title == "TikTok"


def test_sort_order_setzt_bestehende_liste_fort(ctx):
    c, db, _ = ctx
    c.post("/api/shopping-list/items", json={"name": "Milch"})
    pid = _anlegen(c, "tiktok", TIKTOK, TIKTOK_ERGEBNIS)["id"]
    c.post(f"/api/external-posts/{pid}/to-shopping-list")

    orders = [i.sort_order for i in db.query(ShoppingListItem).all()]
    assert len(orders) == len(set(orders)), "sort_order muss eindeutig bleiben"
    assert min(orders) == 0


def test_einkaufsliste_bleibt_lesbar(ctx):
    """F2b-Vertrag: Aggregation und Fortschritt dürfen unberührt bleiben."""
    c, _, _ = ctx
    pid = _anlegen(c, "tiktok", TIKTOK, TIKTOK_ERGEBNIS)["id"]
    c.post(f"/api/external-posts/{pid}/to-shopping-list")

    liste = c.get("/api/shopping-list").json()
    assert liste["progress"]["done"] == 0
    assert liste["progress"]["total"] > 0
    assert c.get("/api/shopping-list?group=sum").status_code == 200


def test_ohne_zutaten_wird_nichts_angelegt(ctx):
    c, db, _ = ctx
    pid = _anlegen(c, "instagram", INSTA, INSTA_ERGEBNIS)["id"]

    r = c.post(f"/api/external-posts/{pid}/to-shopping-list")
    assert r.status_code == 201
    assert r.json()["created"] == 0
    assert db.query(ShoppingListItem).count() == 0


def test_kaputte_jsonb_eintraege_werden_uebersprungen(ctx):
    """`extracted_ingredients` ist JSONB — der Inhalt ist nicht garantiert."""
    c, db, _ = ctx
    with patch("app.external_posts.router.fetch_oembed", side_effect=OEmbedError("x")):
        pid = c.post("/api/external-posts", json={"platform": "tiktok", "url": TIKTOK}).json()["id"]

    post = db.query(ExternalPost).one()
    post.extracted_ingredients = ["kein dict", {"kein": "name"}, {"name": "  "}, {"name": "Feta"}]
    db.commit()

    r = c.post(f"/api/external-posts/{pid}/to-shopping-list")
    assert r.json()["created"] == 1
    assert db.query(ShoppingListItem).one().name == "Feta"


def test_to_shopping_list_nur_owner(ctx):
    c, db, als = ctx
    pid = _anlegen(c, "tiktok", TIKTOK, TIKTOK_ERGEBNIS)["id"]
    als("fremd")
    assert c.post(f"/api/external-posts/{pid}/to-shopping-list").status_code == 403
    assert db.query(ShoppingListItem).count() == 0


def test_to_shopping_list_unbekannt_404(ctx):
    c, _, _ = ctx
    assert c.post("/api/external-posts/9999/to-shopping-list").status_code == 404

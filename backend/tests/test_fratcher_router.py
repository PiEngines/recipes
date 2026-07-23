"""Tests für das Fratcher-Matching (/api/fratcher/match, BUG-57/58).

Übt den Endpoint gegen eine echte SQLite-Session aus — nicht gegen die
gemockte Session aus conftest.py. Belegt wird die Matching-Semantik (Synonyme,
Fuzzy, Basics, Skip) und dass die Queryzahl nicht mit der Rezeptzahl wächst.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import event

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.fratcher.router import router as fratcher_router
from app.models import Ingredient, Recipe, User
from app.models.media import Media
from app.models.user import UserRole
from tests.dbfixtures import make_session_factory, make_user


def _rezept(db, rid, titel, zutaten, autor=1):
    db.add(Recipe(id=rid, title=titel, servings=2, created_by=autor, author_id=autor))
    for i, name in enumerate(zutaten):
        db.add(Ingredient(id=rid * 100 + i, recipe_id=rid, name=name, amount="1", unit="g", sort_order=i))


@pytest.fixture
def ctx():
    """App + Session mit einem Küchenchef (sieht alles) und drei Rezepten."""
    Session = make_session_factory()
    db = Session()
    chef = make_user(db, 1, "chefin", UserRole.kuechenchef)
    _rezept(db, 1, "Tomatensugo", ["Tomate", "Zwiebel", "Salz"])
    _rezept(db, 2, "Kartoffelsuppe", ["Kartoffel", "Lauch", "Sahne", "Pfeffer"])
    _rezept(db, 3, "Salzwasser", ["Salz", "Wasser"])
    db.commit()

    app = FastAPI()
    app.include_router(fratcher_router)
    app.dependency_overrides[get_db] = lambda: Session()
    app.dependency_overrides[get_current_user] = lambda: chef

    yield TestClient(app), db, Session
    db.close()


def _match(client, zutaten, basics=("salz", "pfeffer", "wasser")):
    r = client.post("/api/fratcher/match", json={"ingredients": list(zutaten), "basics": list(basics)})
    assert r.status_code == 200
    return {m["id"]: m for m in r.json()["matches"]}


# ── Deckung und Prozente ─────────────────────────────────────────────────────

def test_vollstaendige_deckung(ctx):
    c, _, _ = ctx
    treffer = _match(c, ["Tomate", "Zwiebel"])
    assert treffer[1]["missing"] == []
    assert treffer[1]["pct"] == 1.0
    assert treffer[1]["title"] == "Tomatensugo"


def test_teilweise_deckung_nennt_die_fehlenden(ctx):
    c, _, _ = ctx
    treffer = _match(c, ["Kartoffel"])
    # Salz und Pfeffer sind Basics und zählen nicht mit.
    assert treffer[2]["missing"] == ["Lauch", "Sahne"]
    assert treffer[2]["pct"] == pytest.approx(1 / 3)


def test_ohne_vorrat_fehlt_alles(ctx):
    c, _, _ = ctx
    treffer = _match(c, [])
    assert treffer[1]["pct"] == 0.0
    assert treffer[1]["missing"] == ["Tomate", "Zwiebel"]


# ── Synonyme und Fuzzy statt Stringvergleich ─────────────────────────────────

def test_plural_deckt_singular(ctx):
    """Der Client verglich mit `includes()` — „Tomaten" deckte „Tomate" nicht."""
    c, _, _ = ctx
    treffer = _match(c, ["Tomaten", "Zwiebeln"])
    assert treffer[1]["missing"] == []


def test_tippfehler_greift_ueber_die_fuzzy_schwelle(ctx):
    c, _, _ = ctx
    treffer = _match(c, ["Kartofel", "Lauch", "Sahne"])
    assert treffer[2]["missing"] == []


def test_klar_fremdes_bleibt_fehlend(ctx):
    c, _, _ = ctx
    treffer = _match(c, ["Schokolade"])
    assert set(treffer[1]["missing"]) == {"Tomate", "Zwiebel"}
    assert treffer[1]["pct"] == 0.0


# ── Basics ───────────────────────────────────────────────────────────────────

def test_basics_zaehlen_weder_als_relevant_noch_als_fehlend(ctx):
    c, _, _ = ctx
    treffer = _match(c, ["Tomate", "Zwiebel"])
    assert "Salz" not in treffer[1]["missing"]
    # Ohne Basics wäre Salz eine dritte relevante Zutat und pct < 1.
    assert treffer[1]["pct"] == 1.0


def test_basics_vergleich_ist_case_insensitive(ctx):
    c, _, _ = ctx
    treffer = _match(c, ["Tomate", "Zwiebel"], basics=["SALZ", "  Pfeffer  ", "wasser"])
    assert treffer[1]["pct"] == 1.0


def test_rezept_nur_aus_basics_wird_uebersprungen(ctx):
    """Früher `skip: true` — es wäre immer ein Volltreffer und sagt nichts aus."""
    c, _, _ = ctx
    treffer = _match(c, ["Tomate"])
    assert 3 not in treffer


def test_ohne_basics_zaehlt_alles(ctx):
    c, _, _ = ctx
    treffer = _match(c, ["Salz", "Wasser"], basics=[])
    assert 3 in treffer
    assert treffer[3]["missing"] == []


# ── Media ────────────────────────────────────────────────────────────────────

def test_media_kommt_mit_und_bevorzugt_das_primaere_bild(ctx):
    c, db, _ = ctx
    db.add(Media(
        id=1, entity_type="recipe", entity_id=1, media_type="image", filename="a.webp",
        storage_path="recipe/1/images/a.webp", thumbnail_path="recipe/1/images/a_thumb.webp",
        is_primary=True, sort_order=5, processing_status="ready", uploaded_by=1,
    ))
    db.add(Media(
        id=2, entity_type="recipe", entity_id=1, media_type="image", filename="b.webp",
        storage_path="recipe/1/images/b.webp", thumbnail_path=None,
        is_primary=False, sort_order=0, processing_status="ready", uploaded_by=1,
    ))
    db.commit()

    treffer = _match(c, ["Tomate", "Zwiebel"])
    assert treffer[1]["media"]["url"].endswith("recipe/1/images/a.webp")
    assert treffer[1]["media"]["thumbnail_url"].endswith("recipe/1/images/a_thumb.webp")


def test_ohne_bild_bleibt_media_leer(ctx):
    c, _, _ = ctx
    treffer = _match(c, ["Tomate"])
    assert treffer[1]["media"] is None


# ── Sichtbarkeit ─────────────────────────────────────────────────────────────

def test_fremde_unfreigegebene_rezepte_tauchen_nicht_auf():
    """Küchenhilfe sieht nur Eigenes — der Filter ist derselbe wie in der Liste."""
    Session = make_session_factory()
    db = Session()
    hilfe = make_user(db, 1, "hilfe", UserRole.kuechenhilfe)
    make_user(db, 2, "fremde", UserRole.koch)
    _rezept(db, 1, "Eigenes", ["Tomate"], autor=1)
    _rezept(db, 2, "Fremdes", ["Tomate"], autor=2)
    db.commit()

    app = FastAPI()
    app.include_router(fratcher_router)
    app.dependency_overrides[get_db] = lambda: Session()
    app.dependency_overrides[get_current_user] = lambda: hilfe
    c = TestClient(app)

    treffer = _match(c, ["Tomate"])
    assert set(treffer) == {1}
    db.close()


# ── N+1-Guard ────────────────────────────────────────────────────────────────

def test_queryzahl_waechst_nicht_mit_der_rezeptzahl(ctx):
    """Der eigentliche Punkt von BUG-58: eine Query-Runde, egal wie viele Rezepte.

    Vorher lud der Client Liste + Detail je Rezept + Media je Treffer. Wäre das
    N+1 nur hierher gewandert (Zutaten oder Bild je Rezept nachladen), stiege
    die Zahl der SELECTs mit der Rezeptzahl — sie bleibt konstant.
    """
    c, db, Session = ctx

    def selects_zaehlen(zusaetzliche_rezepte):
        for n in range(zusaetzliche_rezepte):
            rid = 100 + n
            _rezept(db, rid, f"Rezept {rid}", ["Tomate", "Zwiebel", "Möhre"])
            db.add(Media(
                id=1000 + n, entity_type="recipe", entity_id=rid, media_type="image",
                filename=f"{rid}.webp", storage_path=f"recipe/{rid}/images/x.webp",
                is_primary=True, sort_order=0, processing_status="ready", uploaded_by=1,
            ))
        db.commit()

        gesehen: list[str] = []

        def mitschreiben(conn, cursor, statement, *rest):
            gesehen.append(statement)

        sitzung = Session()
        nutzer = sitzung.get(User, 1)
        event.listen(sitzung.bind, "before_cursor_execute", mitschreiben)
        try:
            app = FastAPI()
            app.include_router(fratcher_router)
            app.dependency_overrides[get_db] = lambda: sitzung
            app.dependency_overrides[get_current_user] = lambda: nutzer
            antwort = TestClient(app).post(
                "/api/fratcher/match", json={"ingredients": ["Tomate"], "basics": []},
            )
            assert antwort.status_code == 200
        finally:
            event.remove(sitzung.bind, "before_cursor_execute", mitschreiben)
            sitzung.close()

        return len([s for s in gesehen if s.strip().lower().startswith("select")])

    wenige = selects_zaehlen(0)
    viele = selects_zaehlen(30)
    assert viele == wenige, f"Queries wachsen mit der Rezeptzahl: {wenige} → {viele}"

"""Merkliste-Löschzustände + Retention/Lazy-Purge (Ü23).

Deckt ab, dass die Favoritenliste soft-deleted Rezepte weiter ausliefert
(grau statt weg), das „endgültige" Löschen die Zeile als Titel-Tombstone
stehen lässt (Medien aber sofort freigibt) und der Lazy-Purge fällige
Tombstones inkl. FK-CASCADE entfernt.
"""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text

import app.storage
from app.auth.dependencies import (
    get_current_user,
    require_chefkoch_or_above,
    require_koch_or_above,
)
from app.database import get_db
from app.favorites.router import router as favorites_router
from app.models import Media, Recipe, UserFavorite
from app.models.user import UserRole
from app.recipes.router import purge_expired, router as recipes_router
from tests.dbfixtures import make_session_factory, make_user


@pytest.fixture
def ctx():
    Session = make_session_factory()
    db = Session()
    # FK-Enforcement in SQLite aktivieren (Default aus), damit der CASCADE-Test
    # den Postgres-Produktivpfad widerspiegelt. Muss vor dem ersten DML laufen.
    db.execute(text("PRAGMA foreign_keys=ON"))

    user = make_user(db, 1, "ich", UserRole.chefkoch)
    db.add(Recipe(id=1, title="Aktiv", servings=4, created_by=1, author_id=1))
    db.add(Recipe(id=2, title="Papierkorb", servings=2, created_by=1, author_id=1))
    db.commit()
    db.query(Recipe).filter(Recipe.id == 2).update({"deleted_at": text("CURRENT_TIMESTAMP")})
    db.add(UserFavorite(user_id=1, recipe_id=1))
    db.add(UserFavorite(user_id=1, recipe_id=2))
    db.commit()

    app = FastAPI()
    app.include_router(favorites_router)
    app.include_router(recipes_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_koch_or_above] = lambda: user
    app.dependency_overrides[require_chefkoch_or_above] = lambda: user
    app.dependency_overrides[get_current_user] = lambda: user

    yield TestClient(app), db
    db.close()


def test_soft_deleted_favorit_bleibt_mit_titel_und_deleted_at(ctx):
    c, _ = ctx
    items = c.get("/api/favorites").json()
    nach_id = {r["id"]: r for r in items}
    # Beide Favoriten kommen zurück — der gelöschte wird NICHT rausgefiltert.
    assert set(nach_id) == {1, 2}
    assert nach_id[2]["title"] == "Papierkorb"
    assert nach_id[2]["deleted_at"] is not None
    assert nach_id[2]["purge_after"] is None      # Papierkorb, noch kein Purge
    # Aktives Rezept trägt keinen Löschzustand.
    assert nach_id[1]["deleted_at"] is None
    assert nach_id[1]["purge_after"] is None


def test_permanent_loeschen_ist_tombstone(ctx, monkeypatch):
    c, db = ctx
    db.add(Media(id=1, entity_type="recipe", entity_id=2, media_type="image",
                 filename="x.jpg", storage_path="p/x.jpg", thumbnail_path="p/t.jpg",
                 uploaded_by=1))
    db.commit()

    freigegeben = []
    monkeypatch.setattr(app.storage.storage, "delete_file", lambda p: freigegeben.append(p))

    r = c.delete("/api/recipes/2/permanent")
    assert r.status_code == 200

    row = db.query(Recipe).filter(Recipe.id == 2).first()
    assert row is not None                       # Zeile bleibt als Titel-Tombstone
    assert row.title == "Papierkorb"             # Titel bleibt lesbar
    assert row.deleted_at is not None            # bleibt gesetzt
    assert row.purge_after is not None           # Retention-Frist gesetzt
    assert db.query(Media).count() == 0          # Medien sofort freigegeben
    assert set(freigegeben) == {"p/x.jpg", "p/t.jpg"}


def test_purge_expired_raeumt_faellige_inkl_cascade(ctx):
    c, db = ctx
    vergangen = datetime.now(timezone.utc) - timedelta(days=1)
    db.query(Recipe).filter(Recipe.id == 2).update({"purge_after": vergangen})
    db.commit()

    entfernt = purge_expired(db)
    assert entfernt == 1
    assert db.query(Recipe).filter(Recipe.id == 2).first() is None
    # FK-CASCADE räumt den Favoriteneintrag mit weg.
    assert db.query(UserFavorite).filter(UserFavorite.recipe_id == 2).count() == 0
    # Nicht fällige/aktive Zeilen bleiben unberührt.
    assert db.query(Recipe).filter(Recipe.id == 1).first() is not None
    assert db.query(UserFavorite).filter(UserFavorite.recipe_id == 1).count() == 1


def test_purge_expired_laesst_offene_frist_stehen(ctx):
    c, db = ctx
    zukunft = datetime.now(timezone.utc) + timedelta(days=10)
    db.query(Recipe).filter(Recipe.id == 2).update({"purge_after": zukunft})
    db.commit()

    assert purge_expired(db) == 0
    assert db.query(Recipe).filter(Recipe.id == 2).first() is not None

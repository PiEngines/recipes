"""Test der Daten-Migration 0042 (BUG-34).

Geprüft wird die Transformation selbst — gegen eine echte SQLite-Session mit
dem vollen Schema, nicht gegen eine Attrappe. Das Alembic-Gerüst drumherum
(`op.get_bind()`, Revisionskette) läuft erst im Deploy gegen Postgres; deshalb
ist die Umsetzung in `vereinheitlichen(conn)` ausgelagert und hier direkt
aufrufbar.
"""
import importlib.util
from pathlib import Path

import pytest
from sqlalchemy import text

from app.models import Ingredient, Recipe
from app.models.user import UserRole
from tests.dbfixtures import make_session_factory, make_user

MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic" / "versions" / "0042_normalize_ingredient_units.py"
)


def _migration_modul():
    spec = importlib.util.spec_from_file_location("migration_0042", MIGRATION)
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    return modul


@pytest.fixture
def db():
    Session = make_session_factory()
    session = Session()
    make_user(session, 1, "koechin", UserRole.koch)
    session.add(Recipe(id=1, title="Testrezept", servings=2, created_by=1, author_id=1))
    session.commit()
    yield session
    session.close()


def _zutaten(session, paare):
    for i, (name, unit) in enumerate(paare):
        session.add(Ingredient(id=100 + i, recipe_id=1, name=name, amount="1", unit=unit, sort_order=i))
    session.commit()


def _einheiten(session):
    return {n: u for n, u in session.query(Ingredient.name, Ingredient.unit).all()}


def test_bestand_wird_kanonisch(db):
    _zutaten(db, [
        ("Mehl", "Gramm"),
        ("Zucker", "gr"),
        ("Milch", "Liter"),
        ("Öl", "Esslöffel"),
        ("Salz", "prise"),
        ("Eier", "Stück"),
        ("Hefe", "Pkg"),
    ])

    geaendert = _migration_modul().vereinheitlichen(db.connection())
    db.commit()
    db.expire_all()

    assert _einheiten(db) == {
        "Mehl": "g",
        "Zucker": "g",
        "Milch": "l",
        "Öl": "EL",
        "Salz": "Prise",
        "Eier": "St.",
        "Hefe": "Pkg.",
    }
    # Nur echte Änderungen werden gemeldet.
    assert geaendert["Gramm"] == "g"
    assert geaendert["Stück"] == "St."


def test_unbekanntes_und_bereits_kanonisches_bleiben(db):
    _zutaten(db, [
        ("Nüsse", "Handvoll"),
        ("Wein", "Schuss"),
        ("Butter", "g"),
        ("Eier", None),
        ("Petersilie", ""),
    ])

    geaendert = _migration_modul().vereinheitlichen(db.connection())
    db.commit()
    db.expire_all()

    assert _einheiten(db) == {
        "Nüsse": "Handvoll",
        "Wein": "Schuss",
        "Butter": "g",
        "Eier": None,
        "Petersilie": "",
    }
    assert geaendert == {}


def test_mehrere_zeilen_derselben_variante_werden_gemeinsam_erfasst(db):
    _zutaten(db, [("Mehl", "Gramm"), ("Zucker", "Gramm"), ("Grieß", "Gramm")])

    _migration_modul().vereinheitlichen(db.connection())
    db.commit()

    offen = db.execute(text("SELECT COUNT(*) FROM ingredients WHERE unit = 'Gramm'")).scalar()
    assert offen == 0


def test_downgrade_ist_ein_no_op():
    """Dokumentiert die Absicht: die Originalschreibweisen sind weg."""
    modul = _migration_modul()
    assert modul.downgrade() is None
    assert modul.revision == "0042"
    assert modul.down_revision == "0041"

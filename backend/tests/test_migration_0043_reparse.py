"""Test der Daten-Migration 0043 (FR-N).

Wie bei 0042: geprüft wird die Transformation gegen eine echte SQLite-Session
mit dem vollen Schema, nicht gegen eine Attrappe. Das Alembic-Gerüst drumherum
läuft erst im Deploy gegen Postgres, deshalb ist die Umsetzung in
`reparse(conn)` ausgelagert und hier direkt aufrufbar.
"""
import importlib.util
from pathlib import Path

import pytest

from app.models import Ingredient, Recipe
from app.models.user import UserRole
from tests.dbfixtures import make_session_factory, make_user

MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic" / "versions" / "0043_reparse_ingredient_names.py"
)


def _migration_modul():
    spec = importlib.util.spec_from_file_location("migration_0043", MIGRATION)
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


def _zutaten(session, tripel):
    for i, (name, amount, unit) in enumerate(tripel):
        session.add(Ingredient(id=100 + i, recipe_id=1, name=name, amount=amount, unit=unit, sort_order=i))
    session.commit()


def _stand(session):
    return {
        i.id: (i.name, i.amount, i.unit)
        for i in session.query(Ingredient).order_by(Ingredient.id).all()
    }


def test_einheit_wandert_aus_dem_namen(db):
    _zutaten(db, [
        ("gr mehl", "50", None),
        ("gramm Zucker", "80", None),
        ("EL Honig", "2", None),
        ("liter Milch", "1", None),
    ])

    geaendert = _migration_modul().reparse(db.connection())
    db.commit()
    db.expire_all()

    assert _stand(db) == {
        100: ("Mehl", "50", "g"),
        101: ("Zucker", "80", "g"),
        102: ("Honig", "2", "EL"),
        103: ("Milch", "1", "l"),
    }
    assert ("gr mehl", "Mehl", "g") in geaendert
    assert len(geaendert) == 4


def test_zeile_ohne_menge_bleibt_unangetastet(db):
    """Der Fehltreffer-Guard — ohne Menge wird nichts herausgelöst."""
    _zutaten(db, [
        ("El Paso Sauce", None, None),
        ("gr mehl", "", None),
    ])

    _migration_modul().reparse(db.connection())
    db.commit()
    db.expire_all()

    stand = _stand(db)
    assert stand[100] == ("El Paso Sauce", None, None)
    # Nur der Name wird groß geschrieben, die Einheit bleibt im Namen.
    assert stand[101] == ("Gr mehl", "", None)


def test_gesetzte_einheit_wird_nicht_ueberstimmt(db):
    _zutaten(db, [("gr mehl", "50", "TL"), ("Butter", "100", "g")])

    geaendert = _migration_modul().reparse(db.connection())
    db.commit()
    db.expire_all()

    stand = _stand(db)
    assert stand[100] == ("Gr mehl", "50", "TL")
    # Schon sauber — gar nicht angefasst.
    assert stand[101] == ("Butter", "100", "g")
    assert len(geaendert) == 1


def test_namen_werden_geputzt(db):
    _zutaten(db, [("brauner  senf", "1", "EL"), ("  mehl ", "500", "g")])

    _migration_modul().reparse(db.connection())
    db.commit()
    db.expire_all()

    stand = _stand(db)
    assert stand[100] == ("Brauner senf", "1", "EL")
    assert stand[101] == ("Mehl", "500", "g")


def test_reine_einheit_ohne_zutat_bleibt_stehen(db):
    """„50 gr" ohne Zutatennamen würde sonst eine namenlose Zeile ergeben."""
    _zutaten(db, [("gr", "50", None)])

    _migration_modul().reparse(db.connection())
    db.commit()
    db.expire_all()

    assert _stand(db)[100] == ("Gr", "50", None)


def test_saubere_zeilen_werden_nicht_gemeldet(db):
    _zutaten(db, [("Mehl", "500", "g"), ("Eier", "3", None)])

    geaendert = _migration_modul().reparse(db.connection())
    db.commit()

    assert geaendert == []


def test_downgrade_ist_ein_no_op():
    """Dokumentiert die Absicht: die Original-Namen sind weg."""
    modul = _migration_modul()
    assert modul.downgrade() is None
    assert modul.revision == "0043"
    assert modul.down_revision == "0042"

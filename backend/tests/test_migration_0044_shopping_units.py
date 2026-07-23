"""Test der Daten-Migration 0044 (BUG-34, Nachzug Einkaufsliste).

Wie bei 0042/0043: geprüft wird die Transformation gegen eine echte
SQLite-Session mit dem vollen Schema. Das Alembic-Gerüst drumherum läuft erst
im Deploy gegen Postgres, deshalb ist die Umsetzung in `vereinheitlichen(conn)`
ausgelagert und hier direkt aufrufbar.
"""
import importlib.util
from pathlib import Path

import pytest
from sqlalchemy import text

from app.models import ShoppingListItem
from app.models.user import UserRole
from tests.dbfixtures import make_session_factory, make_user

MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic" / "versions" / "0044_normalize_shopping_unit.py"
)


def _migration_modul():
    spec = importlib.util.spec_from_file_location("migration_0044", MIGRATION)
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    return modul


@pytest.fixture
def db():
    Session = make_session_factory()
    session = Session()
    make_user(session, 1, "koechin", UserRole.koch)
    session.commit()
    yield session
    session.close()


def _positionen(session, paare):
    for i, (name, unit) in enumerate(paare):
        session.add(ShoppingListItem(
            id=100 + i, user_id=1, name=name, amount="1", unit=unit, sort_order=i,
        ))
    session.commit()


def _einheiten(session):
    return {n: u for n, u in session.query(ShoppingListItem.name, ShoppingListItem.unit).all()}


def test_bestand_wird_kanonisch(db):
    _positionen(db, [
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
    assert geaendert["Gramm"] == "g"
    assert geaendert["Stück"] == "St."


def test_unbekanntes_und_leeres_bleiben(db):
    """Kein Datenverlust: eine fremde Einheit ist keine falsche."""
    _positionen(db, [
        ("Nüsse", "Handvoll"),
        ("Wein", "Schuss"),
        ("Butter", "g"),
        ("Brot", None),
        ("Petersilie", ""),
    ])

    geaendert = _migration_modul().vereinheitlichen(db.connection())
    db.commit()
    db.expire_all()

    assert _einheiten(db) == {
        "Nüsse": "Handvoll",
        "Wein": "Schuss",
        "Butter": "g",
        "Brot": None,
        "Petersilie": "",
    }
    assert geaendert == {}


def test_mehrere_positionen_derselben_variante_gemeinsam(db):
    _positionen(db, [("Mehl", "Gramm"), ("Zucker", "Gramm"), ("Grieß", "Gramm")])

    _migration_modul().vereinheitlichen(db.connection())
    db.commit()

    offen = db.execute(text(
        "SELECT COUNT(*) FROM shopping_list_items WHERE unit = 'Gramm'"
    )).scalar()
    assert offen == 0


def test_lauf_ist_idempotent(db):
    """Zweiter Durchgang meldet nichts mehr und ändert nichts."""
    _positionen(db, [("Mehl", "Gramm"), ("Nüsse", "Handvoll")])

    modul = _migration_modul()
    modul.vereinheitlichen(db.connection())
    db.commit()
    db.expire_all()
    nach_erstem = _einheiten(db)

    zweiter = modul.vereinheitlichen(db.connection())
    db.commit()
    db.expire_all()

    assert zweiter == {}
    assert _einheiten(db) == nach_erstem


def test_keine_zeile_bleibt_unkanonisch(db):
    """Der Self-Check der Übergabe, als Test formuliert."""
    from app.utils.units import normalize_label

    _positionen(db, [("Mehl", "Gramm"), ("Öl", "essl"), ("Nüsse", "Handvoll"), ("Brot", None)])

    _migration_modul().vereinheitlichen(db.connection())
    db.commit()
    db.expire_all()

    offen = [
        (n, u) for n, u in db.query(ShoppingListItem.name, ShoppingListItem.unit).all()
        if u is not None and u != normalize_label(u)
    ]
    assert offen == []


def test_downgrade_ist_ein_no_op():
    """Dokumentiert die Absicht: die Originalschreibweisen sind weg."""
    modul = _migration_modul()
    assert modul.downgrade() is None
    assert modul.revision == "0044"
    assert modul.down_revision == "0043"

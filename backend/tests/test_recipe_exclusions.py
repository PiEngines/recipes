"""recipe_exclusions M2M + „Alkohol"-Entfernung (Ü25, Migration 0049).

Die M2M-Relation und ihr FK-CASCADE laufen gegen eine echte SQLite-Session
mit dem vollen Schema (recipe_exclusions steckt in Base.metadata). Die
Taxonomie-Bereinigung („Alkohol" raus, idempotent zurück) wird als reine
SQL-Semantik geprüft — das Alembic-Gerüst selbst läuft im Deploy gegen Postgres.
"""
import pytest
from sqlalchemy import text

from app.models import Exclusion, Recipe
from app.models.user import UserRole
from tests.dbfixtures import make_session_factory, make_user


@pytest.fixture
def db():
    Session = make_session_factory()
    session = Session()
    session.execute(text("PRAGMA foreign_keys=ON"))  # FK-Enforcement wie in Prod (Postgres)
    make_user(session, 1, "koechin", UserRole.koch)
    session.commit()
    yield session
    session.close()


def test_recipe_exclusions_relationship_beidseitig(db):
    schwein = Exclusion(id=1, name="Schweinefleisch")
    db.add(schwein)
    r = Recipe(id=1, title="Gulasch", created_by=1, author_id=1)
    r.exclusions = [schwein]
    db.add(r)
    db.commit()
    db.expire_all()

    assert [e.name for e in db.get(Recipe, 1).exclusions] == ["Schweinefleisch"]
    # Rückrichtung über back_populates.
    assert [rz.id for rz in db.get(Exclusion, 1).recipes] == [1]


def test_recipe_delete_raeumt_exclusions_per_cascade(db):
    db.add(Exclusion(id=1, name="Rindfleisch"))
    r = Recipe(id=1, title="Steak", created_by=1, author_id=1)
    db.add(r)
    db.commit()
    db.execute(text("INSERT INTO recipe_exclusions (recipe_id, exclusion_id) VALUES (1, 1)"))
    db.commit()

    db.delete(db.get(Recipe, 1))
    db.commit()

    # FK ondelete=CASCADE räumt die Verknüpfung mit weg …
    assert db.execute(text("SELECT COUNT(*) FROM recipe_exclusions")).scalar() == 0
    # … die Taxonomie-Zeile bleibt aber bestehen.
    assert db.query(Exclusion).count() == 1


def test_alkohol_delete_und_idempotenter_reinsert(db):
    # Ausgangslage wie nach 0046-Seed.
    for i, name in enumerate(["Schweinefleisch", "Alkohol"], start=1):
        db.add(Exclusion(id=i, name=name))
    db.commit()

    # upgrade-Semantik: Alkohol raus.
    db.execute(text("DELETE FROM exclusions WHERE name = 'Alkohol'"))
    db.commit()
    assert db.query(Exclusion).filter_by(name="Alkohol").count() == 0

    # downgrade-Semantik: idempotent zurück — zweimal ausführen ändert nichts.
    reinsert = text(
        "INSERT INTO exclusions (name) SELECT 'Alkohol' "
        "WHERE NOT EXISTS (SELECT 1 FROM exclusions WHERE name = 'Alkohol')"
    )
    db.execute(reinsert)
    db.execute(reinsert)
    db.commit()
    assert db.query(Exclusion).filter_by(name="Alkohol").count() == 1

"""Unit-Tests fuer die Seed-Logik von plant_ingredient_map (Phase 4).

Kein echter DB-Zugriff: `_derive_plant_tokens` bekommt eine minimal gemockte
Session, die `query(Plant).all()` beantwortet.
"""
from types import SimpleNamespace

import pytest

from app.plants.ingredient_map_seed import _derive_plant_tokens, _split_synonyms
from app.plants.ingredient_resolver import canonical_tokens


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeDB:
    """Beantwortet nur query(...).all() mit einer festen Zeilenliste."""
    def __init__(self, rows):
        self._rows = rows

    def query(self, *args, **kwargs):
        return _FakeQuery(self._rows)


def _plant(pid, name, synonyme=None):
    return SimpleNamespace(id=pid, deutscher_name=name, synonyme=synonyme)


class TestSplitSynonyms:
    def test_none_returns_empty(self):
        assert _split_synonyms(None) == []

    def test_empty_string_returns_empty(self):
        assert _split_synonyms("") == []

    def test_comma_separated(self):
        assert _split_synonyms("Möhre, Karotte") == ["Möhre", "Karotte"]

    def test_mixed_delimiters(self):
        # Semikolon, Slash und Pipe werden ebenfalls als Trenner behandelt
        assert _split_synonyms("a; b / c | d") == ["a", "b", "c", "d"]

    def test_strips_whitespace_and_drops_blanks(self):
        assert _split_synonyms("  x ,, y  ") == ["x", "y"]


class TestDerivePlantTokens:
    def test_plant_in_vocab_is_linked(self):
        vokab = canonical_tokens("Basilikum")
        db = _FakeDB([_plant("KR1", "Basilikum")])
        result = _derive_plant_tokens(db, vokab)
        assert "KR1" in result
        assert "basilikum" in result["KR1"]

    def test_plant_not_in_vocab_is_skipped(self):
        # Eibe ist keine Koch-Zutat -> kein Link
        vokab = canonical_tokens("Basilikum")
        db = _FakeDB([_plant("KR9", "Eibe")])
        result = _derive_plant_tokens(db, vokab)
        assert "KR9" not in result

    def test_synonym_of_plant_matches_vocab(self):
        # Vokabular kennt "Karotte"; Pflanze heisst "Möhre" -> Treffer ueber Synonyme
        vokab = canonical_tokens("Karotte")
        db = _FakeDB([_plant("KR2", "Möhre")])
        result = _derive_plant_tokens(db, vokab)
        assert "KR2" in result
        assert result["KR2"] & canonical_tokens("Karotte")

    def test_plant_synonyme_field_is_considered(self):
        # deutscher_name trifft nicht, aber ein Eintrag im synonyme-Feld schon
        vokab = canonical_tokens("Basilikum")
        db = _FakeDB([_plant("KR3", "Irgendwas", synonyme="Basilikum, Königskraut")])
        result = _derive_plant_tokens(db, vokab)
        assert "KR3" in result
        assert "basilikum" in result["KR3"]

    def test_only_vocab_tokens_are_stored(self):
        # Gespeichert wird die Schnittmenge mit dem Vokabular, kein Fremd-Token
        vokab = canonical_tokens("Basilikum")
        db = _FakeDB([_plant("KR4", "Basilikum")])
        result = _derive_plant_tokens(db, vokab)
        assert result["KR4"] <= vokab

    def test_empty_db_yields_empty_map(self):
        assert _derive_plant_tokens(_FakeDB([]), canonical_tokens("Basilikum")) == {}

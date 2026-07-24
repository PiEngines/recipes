"""Robustes Parsing + „versucht"-Markierung im Saison-Tagging (Ü28 F1).

Kern des Startup-Bugs: `json.loads(text)` warf bei gefencten/leeren Antworten,
sodass kein Rezept getaggt wurde und der Voll-Loop bei jedem Start neu lief.
"""
import sys
from types import ModuleType, SimpleNamespace

import pytest

# `anthropic` ist lokal nicht installiert (nur im Container). Für den Import von
# `matcher` genügt ein Stub — die Tests rufen ohnehin keinen echten Client.
if "anthropic" not in sys.modules:
    _stub = ModuleType("anthropic")
    _stub.Anthropic = object
    sys.modules["anthropic"] = _stub

from app.seasonal import matcher


# ── _parse_tag_response ───────────────────────────────────────────────────────

def test_parse_gefenctes_json_array():
    assert matcher._parse_tag_response('```json\n["tomate", "basilikum"]\n```') == ["tomate", "basilikum"]


def test_parse_fence_ohne_sprache():
    assert matcher._parse_tag_response('```\n["apfel"]\n```') == ["apfel"]


def test_parse_nacktes_array():
    assert matcher._parse_tag_response('["kuerbis"]') == ["kuerbis"]


def test_parse_array_mit_umgebungstext():
    assert matcher._parse_tag_response('Hier: ["birne", "quitte"]. Fertig.') == ["birne", "quitte"]


def test_parse_leerer_text_ist_leere_liste():
    assert matcher._parse_tag_response("") == []
    assert matcher._parse_tag_response("   \n  ") == []


def test_parse_unparsebar_ist_none():
    assert matcher._parse_tag_response("Kein JSON hier.") is None
    assert matcher._parse_tag_response("```json\nkaputt\n```") is None


# ── tag_recipe ────────────────────────────────────────────────────────────────

def _fake_client(text=None, raise_exc=False):
    class _Messages:
        def create(self, **_):
            if raise_exc:
                raise RuntimeError("boom")
            return SimpleNamespace(content=[SimpleNamespace(text=text)])
    return SimpleNamespace(messages=_Messages())


def _recipe():
    return SimpleNamespace(id=1, title="Tomatensuppe", ingredients=[SimpleNamespace(name="Tomate")])


def test_tag_recipe_parst_gefencte_antwort():
    client = _fake_client('```json\n["tomate"]\n```')
    assert matcher.tag_recipe(_recipe(), ["tomate", "basilikum"], client) == ["tomate"]


def test_tag_recipe_leerer_text_ist_leere_liste():
    assert matcher.tag_recipe(_recipe(), ["tomate"], _fake_client("")) == []


def test_tag_recipe_unparsebar_ist_leere_liste():
    assert matcher.tag_recipe(_recipe(), ["tomate"], _fake_client("Erklärung ohne JSON")) == []


def test_tag_recipe_api_fehler_ist_leere_liste():
    assert matcher.tag_recipe(_recipe(), ["tomate"], _fake_client(raise_exc=True)) == []


# ── run_seasonal_matching: jedes Rezept wird „versucht" ───────────────────────

class _FakeQuery:
    def __init__(self, recipes):
        self._recipes = recipes

    def filter(self, *a, **k):
        return self

    def all(self):
        return self._recipes


class _FakeDB:
    def __init__(self, recipes):
        self._recipes = recipes
        self.commits = 0

    def query(self, *a, **k):
        return _FakeQuery(self._recipes)

    def commit(self):
        self.commits += 1

    def rollback(self):
        pass


def test_run_setzt_seasonal_tags_nicht_none(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(matcher.anthropic, "Anthropic", lambda **_: object())
    # Kein echter API-Call — tag_recipe liefert eine leere (aber gesetzte) Liste.
    monkeypatch.setattr(matcher, "tag_recipe", lambda recipe, ids, client: [])

    recipes = [
        SimpleNamespace(id=1, title="A", ingredients=[], seasonal_tags=None),
        SimpleNamespace(id=2, title="B", ingredients=[], seasonal_tags=None),
    ]
    db = _FakeDB(recipes)
    matcher.run_seasonal_matching(db)

    for r in recipes:
        assert r.seasonal_tags is not None
        assert r.seasonal_tags == []
    assert db.commits == 2

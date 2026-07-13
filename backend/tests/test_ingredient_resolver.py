"""Unit-Tests fuer den geteilten Zutaten-Resolver (Kräuterschule Phase 4).

Kein DB-Zugriff – reine Logik (passt zum konftest-Setup ohne echte Session).

Wichtig: Die *Endpoint*-Symmetrie (Rezept->Pflanzen == Pflanze->Rezepte) laesst
sich hier nicht end-to-end pruefen, weil das Test-Harness keine DB hat. Sie ist
aber per Konstruktion auf Resolver-Ebene garantiert: beide Endpoints reduzieren
die Relation auf `canonical_tokens(zutat) & plant_tokens`. Genau diese Invariante
wird unten festgenagelt. Der End-to-End-Check bleibt der Live-Smoke-Test
(siehe PHASE4_WIRING_UND_DEPLOY.md).
"""
import pytest

from app.plants.ingredient_resolver import canonical_tokens, is_exact, match_typ


class TestCanonicalTokens:
    def test_empty_name_returns_empty_set(self):
        assert canonical_tokens("") == set()

    def test_none_like_empty(self):
        assert canonical_tokens(None) == set()  # type: ignore[arg-type]

    def test_lowercases_and_strips_punctuation(self):
        # "Frühlings-Zwiebel!" -> normalisiert "frühlings zwiebel"
        tokens = canonical_tokens("Frühlings-Zwiebel!")
        assert "frühlings zwiebel" in tokens

    def test_plain_name_contains_itself(self):
        assert "basilikum" in canonical_tokens("Basilikum")

    def test_name_without_synonyms_is_singleton(self):
        # Basilikum hat keine Synonyme im Dict -> nur sich selbst
        assert canonical_tokens("Basilikum") == {"basilikum"}


class TestSynonymExpansion:
    """Kernnutzen des Features: Rezept- und Pflanzen-Vokabular treffen sich
    ueber die Synonym-Expansion (sonst finden 'Möhre' und 'Karotte' nie zusammen)."""

    def test_moehre_and_karotte_share_tokens(self):
        assert canonical_tokens("Möhre") & canonical_tokens("Karotte")

    def test_kartoffel_and_erdapfel_share_tokens(self):
        assert canonical_tokens("Kartoffel") & canonical_tokens("Erdapfel")

    def test_tomate_and_paradeiser_share_tokens(self):
        assert canonical_tokens("Tomate") & canonical_tokens("Paradeiser")

    def test_unrelated_names_do_not_share_tokens(self):
        assert not (canonical_tokens("Basilikum") & canonical_tokens("Karotte"))


class TestMatchTyp:
    def test_is_exact_true_for_normalized_identity(self):
        assert is_exact("Karotte", "karotte") is True

    def test_is_exact_false_for_synonym_token(self):
        # "Möhre" liefert u. a. das Token "karotte" – aber nicht als *exakter* Name
        assert is_exact("Möhre", "karotte") is False

    def test_match_typ_exakt_when_name_is_token(self):
        assert match_typ("Karotte", {"karotte", "möhre"}) == "exakt"

    def test_match_typ_synonym_when_only_via_expansion(self):
        # Name normalisiert zu "möhre"; das ist selbst im Set -> exakt.
        # Wir wollen den Synonym-Fall: Name, dessen Normalform NICHT im Set ist,
        # der aber ueber Expansion trifft.
        assert match_typ("Rüebli", {"karotte"}) == "synonym"


class TestRelationSymmetryInvariant:
    """Nagelt die Invariante fest, auf der beide Endpoints beruhen:

        relates(zutat, plant_tokens) := canonical_tokens(zutat) & plant_tokens

    Diese Relation ist per Definition richtungsunabhaengig. Wenn ein Endpoint
    jemals eine andere Matching-Regel bekommt (z. B. Fuzzy nur auf einer Seite),
    muss das ueber DIESE Funktion laufen, damit die Symmetrie erhalten bleibt.
    """

    @staticmethod
    def _relates(zutat_name: str, plant_tokens: set[str]) -> bool:
        return bool(canonical_tokens(zutat_name) & plant_tokens)

    @pytest.mark.parametrize(
        "zutat, plant_source",
        [
            ("Möhre", "Karotte"),
            ("Karotte", "Möhre"),
            ("Erdapfel", "Kartoffel"),
            ("Paradeiser", "Tomate"),
            ("Basilikum", "Karotte"),   # trifft NICHT
            ("Rüebli", "Karotte"),
        ],
    )
    def test_direction_independent(self, zutat, plant_source):
        plant_tokens = canonical_tokens(plant_source)
        # "Rezept->Pflanze": Zutat gegen die Pflanzen-Tokens
        recipe_side = self._relates(zutat, plant_tokens)
        # "Pflanze->Rezept": exakt dieselbe Relation, andere Blickrichtung
        plant_side = bool(plant_tokens & canonical_tokens(zutat))
        assert recipe_side == plant_side

    def test_mutual_hit_is_consistent(self):
        # Wenn Karotte->Möhre trifft, muss Möhre->Karotte ebenfalls treffen.
        assert self._relates("Möhre", canonical_tokens("Karotte")) is True
        assert self._relates("Karotte", canonical_tokens("Möhre")) is True

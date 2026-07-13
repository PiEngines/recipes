"""Kräuterschule Phase 4 – geteilter Zutaten-Resolver.

DIE zentrale Wahrheit für die Relation "Rezept R enthält Pflanze P":

    R enthält P  <=>  es gibt eine Zutat in R, deren canonical_tokens
                       die in plant_ingredient_map gespeicherten Tokens von P
                       schneiden.

Beide Endpoints (Rezept->Pflanzen und Pflanze->Rezepte) rufen ausschliesslich
diese Funktionen auf. Dadurch ist die Auswertung per Konstruktion SYMMETRISCH –
es kann nicht passieren, dass Rezept X Pflanze Y zeigt, Pflanze Y aber Rezept X
nicht listet.

Deterministisch: nur Normalisierung + Synonym-Set (aus matching.py). KEIN
rapidfuzz zur Query-Zeit. Fuzzy beeinflusst spaeter ausschliesslich den
gespeicherten Seed bzw. – falls gewuenscht – wird hier zentral ergaenzt, sodass
die Symmetrie erhalten bleibt.
"""
from app.recipes.matching import _normalize, _synonym_variants


def canonical_tokens(name: str) -> set[str]:
    """Normalisierte, synonym-expandierte Token-Menge eines Zutaten-/Pflanzennamens.

    Wiederverwendung der bestehenden Rezept-Matching-Logik, damit Rezept- und
    Pflanzenseite durch DIESELBE Normalisierung laufen (sonst treffen sich
    z. B. "Möhre" und "Karotte" nie).
    """
    if not name:
        return set()
    return {t for t in _synonym_variants(name) if t}


def is_exact(name: str, token: str) -> bool:
    """True, wenn der Name direkt (ohne Synonym-Umweg) dem Token entspricht.

    Dient nur der Transparenz im Response (match_typ = 'exakt' | 'synonym').
    """
    return _normalize(name) == token


def match_typ(name: str, tokens: set[str]) -> str:
    """'exakt', falls der normalisierte Name selbst einer der Tokens ist,
    sonst 'synonym' (Treffer kam nur ueber die Synonym-Expansion zustande)."""
    return "exakt" if _normalize(name) in tokens else "synonym"

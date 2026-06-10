"""Ingredient matching pipeline.

Matches a recipe step's instruction text against the recipe's ingredient list
in three stages:

1. Exact match (substring), expanded via the synonym dictionary
   (backend/app/data/ingredient_synonyms.json).
2. Fuzzy match via rapidfuzz token-set-ratio (threshold 85) — catches plural
   forms and minor spelling variants not covered by the synonym dict.
3. AI-based matching — placeholder, see TODO in match_ingredients().
"""
import json
import re
from functools import lru_cache
from pathlib import Path

from rapidfuzz import fuzz

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SYNONYMS_PATH = DATA_DIR / "ingredient_synonyms.json"
BLS_PATH = DATA_DIR / "bls_ingredients.json"

FUZZY_THRESHOLD = 85

# Generic descriptor words that appear throughout BLS food names but are not
# themselves ingredient names; excluded so get_suspicious_tokens() doesn't
# flag every "roh"/"ohne"/"Konserve" etc. in a step's instruction.
BLS_STOPWORDS = {
    "roh", "gekocht", "gegart", "gebraten", "gedünstet", "gedämpft", "getrocknet",
    "tiefgefroren", "gebacken", "geschmort", "ohne", "mit", "und", "oder", "fett",
    "fettarm", "anteil", "gesamt", "sonstige", "diverse", "divers", "sorten",
    "art", "gemisch", "mischung", "zubereitet", "zubereitung", "frisch", "instant",
    "pulver", "gehalt", "konserve", "fertig", "fertigprodukt", "stufe", "mind",
}


def _normalize(text: str) -> str:
    return re.sub(r"[^\w\s]", " ", text.lower(), flags=re.UNICODE).strip()


def _word_tokens(text: str) -> set[str]:
    return set(re.findall(r"\b\w+\b", text.lower(), flags=re.UNICODE))


@lru_cache(maxsize=1)
def _load_synonyms() -> dict[str, list[str]]:
    with open(SYNONYMS_PATH, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _load_bls_words() -> frozenset[str]:
    with open(BLS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    words: set[str] = set()
    for item in data:
        for token in _word_tokens(item["name"]):
            if len(token) >= 4 and token not in BLS_STOPWORDS:
                words.add(token)
    return frozenset(words)


def _synonym_variants(name: str) -> set[str]:
    """Normalized name plus all synonyms it is grouped with (in either direction)."""
    norm = _normalize(name)
    variants = {norm}
    for canonical, synonyms in _load_synonyms().items():
        group = {_normalize(canonical)} | {_normalize(s) for s in synonyms}
        if norm in group:
            variants |= group
    return variants


def _fuzzy_match(ing_name: str, instruction_tokens: set[str], instruction_norm: str) -> bool:
    norm = _normalize(ing_name)
    if not norm:
        return False
    if " " in norm:
        return fuzz.token_set_ratio(norm, instruction_norm) >= FUZZY_THRESHOLD
    return any(fuzz.ratio(norm, token) >= FUZZY_THRESHOLD for token in instruction_tokens)


def match_ingredients(step_instruction: str, ingredients: list) -> list[int]:
    """Returns the IDs of the recipe's ingredients that occur in the step instruction."""
    instruction_norm = _normalize(step_instruction)
    instruction_tokens = _word_tokens(step_instruction)

    matched_ids: list[int] = []
    for ing in ingredients:
        # Stage 1: exact match + synonym dict
        if any(variant and variant in instruction_norm for variant in _synonym_variants(ing.name)):
            matched_ids.append(ing.id)
            continue

        # Stage 2: rapidfuzz token-set-ratio
        if _fuzzy_match(ing.name, instruction_tokens, instruction_norm):
            matched_ids.append(ing.id)
            continue

        # Stage 3: AI-based matching
        # TODO: send (step_instruction, ing.name) to an LLM to catch paraphrased
        # or abbreviated ingredient references that stages 1+2 miss.

    return matched_ids


def get_suspicious_tokens(step_instruction: str, ingredients: list) -> list[str]:
    """Words in the instruction that look like ingredients (per the BLS dict)
    but aren't part of the recipe's ingredient list — for the review-flow
    underline highlighting."""
    bls_words = _load_bls_words()

    recipe_words: set[str] = set()
    for ing in ingredients:
        for variant in _synonym_variants(ing.name):
            recipe_words |= _word_tokens(variant)

    suspicious: list[str] = []
    for token in _word_tokens(step_instruction):
        if len(token) < 4 or token in recipe_words or token in suspicious:
            continue
        if token in bls_words:
            suspicious.append(token)

    return suspicious

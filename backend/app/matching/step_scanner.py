"""Scans recipe step instructions for ingredient-like tokens that are not yet
part of the recipe's ingredient list, and proposes BLS matches for review.

Pipeline per step:
1. Tokenize the instruction (lowercase words, special chars stripped).
2. Drop tokens shorter than MIN_TOKEN_LEN, stopwords and pure numbers.
3. Drop tokens that already (fuzzy-)match one of the recipe's ingredients.
4. Fuzzy-match the remaining tokens against the BLS database
   (rapidfuzz token-set-ratio):
     - score >= EINDEUTIG_THRESHOLD -> confidence "eindeutig"
     - score >= VERDACHT_THRESHOLD  -> confidence "verdacht"
     - otherwise -> ignored
5. Persist new (recipe_id, step_id, token) suggestions with status "open".
"""
import json
import logging
import re
from functools import lru_cache
from pathlib import Path

from rapidfuzz import fuzz, process
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.matching.stopwords import is_stopword
from app.models.recipe import Ingredient, RecipeStep
from app.models.step_suggestion import StepUnmatchedSuggestion

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
BLS_PATH = DATA_DIR / "bls_ingredients.json"

MIN_TOKEN_LEN = 3
INGREDIENT_FUZZY_THRESHOLD = 85
EINDEUTIG_THRESHOLD = 92
VERDACHT_THRESHOLD = 70

_TOKEN_RE = re.compile(r"[a-zäöüßA-ZÄÖÜ]+", re.UNICODE)


def _tokenize(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text or "")]


def _normalize(text: str) -> str:
    return re.sub(r"[^\w\s]", " ", (text or "").lower(), flags=re.UNICODE).strip()


@lru_cache(maxsize=1)
def _load_bls_entries() -> list[dict]:
    with open(BLS_PATH, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _bls_names() -> list[str]:
    return [_normalize(item["name"]) for item in _load_bls_entries()]


def _token_matches_ingredients(token: str, ingredient_names: list[str]) -> bool:
    """True if `token` already (fuzzy-)matches one of the recipe's ingredients."""
    for name in ingredient_names:
        norm = _normalize(name)
        if not norm:
            continue
        if token == norm:
            return True
        if " " in norm:
            if fuzz.token_set_ratio(token, norm) >= INGREDIENT_FUZZY_THRESHOLD:
                return True
        elif fuzz.ratio(token, norm) >= INGREDIENT_FUZZY_THRESHOLD:
            return True
    return False


def _best_bls_match(token: str) -> tuple[str, str, float] | None:
    """Best BLS match for `token`, as (bls_id, bls_name, score) or None."""
    names = _bls_names()
    if not names:
        return None
    result = process.extractOne(token, names, scorer=fuzz.token_set_ratio)
    if not result:
        return None
    _matched_name, score, idx = result
    entry = _load_bls_entries()[idx]
    return entry["bls_id"], entry["name"], score


def scan_steps_for_unmatched(recipe_id: int, db: Session) -> int:
    """Scans all steps of a recipe and persists new step-suggestions.

    Returns the number of newly created suggestions.
    """
    steps = db.query(RecipeStep).filter(RecipeStep.recipe_id == recipe_id).all()
    if not steps:
        return 0

    ingredient_names = [
        ing.name for ing in db.query(Ingredient).filter(Ingredient.recipe_id == recipe_id).all()
    ]

    existing = {
        (row.step_id, row.token)
        for row in db.query(
            StepUnmatchedSuggestion.step_id, StepUnmatchedSuggestion.token
        ).filter(StepUnmatchedSuggestion.recipe_id == recipe_id)
    }

    created = 0
    for step in steps:
        seen: set[str] = set()
        for token in _tokenize(step.instruction):
            if len(token) < MIN_TOKEN_LEN or is_stopword(token) or token in seen:
                continue
            seen.add(token)

            if (step.id, token) in existing:
                continue
            if _token_matches_ingredients(token, ingredient_names):
                continue

            match = _best_bls_match(token)
            if not match:
                continue
            bls_id, bls_name, score = match

            if score >= EINDEUTIG_THRESHOLD:
                confidence = "eindeutig"
            elif score >= VERDACHT_THRESHOLD:
                confidence = "verdacht"
            else:
                continue

            db.add(StepUnmatchedSuggestion(
                recipe_id=recipe_id,
                step_id=step.id,
                token=token,
                bls_id=bls_id,
                bls_name=bls_name,
                confidence=confidence,
                status="open",
            ))
            existing.add((step.id, token))
            created += 1

    if created:
        db.commit()
    return created


def revalidate_open_suggestions(recipe_id: int, db: Session) -> int:
    """Dismisses open suggestions whose token now matches the ingredient list.

    Called after the recipe's ingredient list changes (PUT /recipes/{id} with
    `ingredients`, or after a suggestion was accepted). Returns the number of
    suggestions dismissed.
    """
    open_suggestions = (
        db.query(StepUnmatchedSuggestion)
        .filter(
            StepUnmatchedSuggestion.recipe_id == recipe_id,
            StepUnmatchedSuggestion.status == "open",
        )
        .all()
    )
    if not open_suggestions:
        return 0

    ingredient_names = [
        ing.name for ing in db.query(Ingredient).filter(Ingredient.recipe_id == recipe_id).all()
    ]

    dismissed = 0
    for suggestion in open_suggestions:
        if _token_matches_ingredients(suggestion.token, ingredient_names):
            suggestion.status = "dismissed"
            dismissed += 1

    if dismissed:
        db.commit()
    return dismissed


def trigger_step_scan(recipe_id: int) -> None:
    """Background-task entry point: scans a recipe's steps in its own DB session."""
    db = SessionLocal()
    try:
        scan_steps_for_unmatched(recipe_id, db)
    except Exception:
        logger.exception("Step scan failed for recipe %d", recipe_id)
    finally:
        db.close()

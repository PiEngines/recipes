import json
import logging
import os
from pathlib import Path

import anthropic

from app.models import Recipe

logger = logging.getLogger(__name__)

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "seasonal_data.json"


def load_seasonal_ids() -> list[str]:
    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)
    ids = []
    for category in ("vegetables", "fruits", "salads", "herbs"):
        for item in data.get(category, []):
            ids.append(item["id"])
    return ids


def _parse_tag_response(text: str):
    """JSON-Array aus einer (ggf. in Markdown gefencten) Modellantwort ziehen.

    Rückgabe: die Liste (evtl. leer) — oder ``None``, wenn nichts Parsebares
    drinsteht. Robust gegen ```json…```-Fences und Vor-/Nachtext, indem vom
    ersten ``[`` bis zum letzten ``]`` geschnitten und erst dann geparst wird.
    """
    t = (text or "").strip()
    if not t:
        return []

    # Markdown-Fences entfernen: ```json … ``` oder ``` … ```.
    if t.startswith("```"):
        t = t[3:]
        if t[:4].lower() == "json":
            t = t[4:]
        if t.endswith("```"):
            t = t[:-3]
        t = t.strip()

    start = t.find("[")
    end = t.rfind("]")
    if start == -1 or end == -1 or end < start:
        return None
    try:
        parsed = json.loads(t[start:end + 1])
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(parsed, list):
        return None
    return [str(x) for x in parsed]


def tag_recipe(recipe, seasonal_ids: list[str], client: anthropic.Anthropic) -> list[str]:
    ingredient_names = ", ".join(i.name for i in recipe.ingredients)
    prompt = f"""Du bekommst einen Rezepttitel und eine Zutatenliste.
Gib ausschließlich ein JSON-Array mit IDs aus der folgenden Liste zurück,
die inhaltlich zu den Zutaten passen. Keine Erklärungen, nur das JSON-Array.
Beispiel: ["tomate", "basilikum"]

Rezept: {recipe.title}
Zutaten: {ingredient_names}
Verfügbare IDs: {", ".join(seasonal_ids)}"""

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception:
        logger.warning("Seasonal tagging: API-Call für Rezept %d fehlgeschlagen", recipe.id)
        return []

    text = (response.content[0].text if response.content else "") or ""
    text = text.strip()
    if not text:
        return []

    parsed = _parse_tag_response(text)
    if parsed is None:
        # Kein Exception-Spam: eine leere/gefencte/kaputte Antwort ist erwartbar.
        logger.warning("Seasonal tagging: Antwort für Rezept %d nicht parsebar: %r", recipe.id, text[:120])
        return []
    return parsed


def run_seasonal_matching(db) -> None:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    seasonal_ids = load_seasonal_ids()

    recipes = db.query(Recipe).filter(Recipe.deleted_at.is_(None)).all()
    for recipe in recipes:
        try:
            tags = tag_recipe(recipe, seasonal_ids, client)
            recipe.seasonal_tags = tags
            db.commit()
            logger.info("Seasonal tags for recipe %d (%s): %s", recipe.id, recipe.title, tags)
        except Exception:
            db.rollback()
            logger.exception("Failed to update seasonal tags for recipe %d", recipe.id)

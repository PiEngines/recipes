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
        text = response.content[0].text
        return json.loads(text)
    except Exception:
        logger.exception("Seasonal tagging failed for recipe %d", recipe.id)
        return []


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

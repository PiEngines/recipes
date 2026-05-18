from sqlalchemy.orm import Session

from app.models import Recipe
from app.models.recipe import RecipeVersion


def _levenshtein(a: str, b: str) -> int:
    a, b = str(a), str(b)
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            curr.append(min(prev[j] + (ca != cb), curr[j] + 1, prev[j + 1] + 1))
        prev = curr
    return prev[len(b)]


def _recipe_snapshot(recipe: Recipe) -> dict:
    return {
        "title": recipe.title,
        "description": recipe.description,
        "prep_time": recipe.prep_time,
        "cook_time": recipe.cook_time,
        "servings": recipe.servings,
        "difficulty": recipe.difficulty,
        "status": recipe.status.value if recipe.status else None,
        "source": recipe.source,
        "category_ids": sorted(c.id for c in (recipe.categories or [])),
        "tag_ids": sorted(t.id for t in (recipe.tags or [])),
        "ingredients": [
            {
                "id": i.id,
                "name": i.name,
                "amount": i.amount,
                "unit": i.unit,
                "component_label": i.component_label,
                "sort_order": i.sort_order,
            }
            for i in sorted(recipe.ingredients or [], key=lambda x: x.sort_order)
        ],
        "steps": [
            {
                "id": s.id,
                "sort_order": s.sort_order,
                "title": s.title,
                "instruction": s.instruction,
                "timer_seconds": s.timer_seconds,
            }
            for s in sorted(recipe.steps or [], key=lambda x: x.sort_order)
        ],
    }


def save_version(recipe: Recipe, old_snapshot: dict, user_id: int, db: Session) -> RecipeVersion:
    new_snapshot = _recipe_snapshot(recipe)

    changed_fields = 0
    changed_chars = 0
    for key in new_snapshot:
        old_val = old_snapshot.get(key)
        new_val = new_snapshot.get(key)
        if old_val != new_val:
            changed_fields += 1
            if isinstance(old_val, str) and isinstance(new_val, str):
                changed_chars += _levenshtein(old_val, new_val)
            elif key == "steps":
                old_instructions = " ".join(s.get("instruction", "") for s in (old_val or []))
                new_instructions = " ".join(s.get("instruction", "") for s in (new_val or []))
                changed_chars += _levenshtein(old_instructions, new_instructions)

    # Current version count
    max_ver = db.query(RecipeVersion).filter(RecipeVersion.recipe_id == recipe.id).count()
    version_number = max_ver + 1

    # Prune if >= 25 versions
    if max_ver >= 25:
        oldest = (
            db.query(RecipeVersion)
            .filter(RecipeVersion.recipe_id == recipe.id)
            .order_by(RecipeVersion.version_number.asc())
            .first()
        )
        if oldest:
            db.delete(oldest)

    ver = RecipeVersion(
        recipe_id=recipe.id,
        version_number=version_number,
        snapshot=new_snapshot,
        changed_fields_count=changed_fields,
        changed_chars_count=changed_chars,
        created_by=user_id,
    )
    db.add(ver)
    db.flush()
    return ver

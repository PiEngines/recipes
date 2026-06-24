from decimal import Decimal
from typing import Optional, Union

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.recipe import Recipe, RecipeComponent
from app.versioning import save_version


def check_circular_reference(db: Session, parent_recipe_id: int, new_module_id: int) -> None:
    """Raise HTTP 400 if embedding new_module_id into parent_recipe_id would create a cycle.

    Checks both direct self-embed and indirect cycles via recursive CTE.
    """
    if new_module_id == parent_recipe_id:
        raise HTTPException(
            status_code=400,
            detail="Dieses Rezept kann nicht eingebunden werden – es ist bereits Bestandteil dieses Rezepts.",
        )

    result = db.execute(
        text(
            """
            WITH RECURSIVE chain AS (
                SELECT child_recipe_id
                FROM recipe_components
                WHERE parent_recipe_id = :new_module_id
                UNION ALL
                SELECT rc.child_recipe_id
                FROM recipe_components rc
                JOIN chain c ON rc.parent_recipe_id = c.child_recipe_id
            )
            SELECT 1 FROM chain WHERE child_recipe_id = :parent_recipe_id
            LIMIT 1
            """
        ),
        {"new_module_id": new_module_id, "parent_recipe_id": parent_recipe_id},
    ).fetchone()

    if result is not None:
        raise HTTPException(
            status_code=400,
            detail="Dieses Rezept kann nicht eingebunden werden – es ist bereits Bestandteil dieses Rezepts.",
        )


def embed_module(
    db: Session,
    parent_recipe_id: int,
    child_recipe_id: int,
    user_id: int,
    sort_order: int = 0,
    flatten_into_parent: bool = False,
    servings_override: Optional[int] = None,
    scale_factor: Optional[Union[float, Decimal]] = None,
) -> RecipeComponent:
    """Embed a module recipe into a parent recipe.

    Creates a frozen snapshot of the module at embed time so future edits
    to the module do not affect this embedding.
    """
    check_circular_reference(db, parent_recipe_id, child_recipe_id)

    child_recipe = db.get(Recipe, child_recipe_id)
    if child_recipe is None:
        raise HTTPException(status_code=404, detail="Modul-Rezept nicht gefunden.")

    # old_snapshot={} intentional: beim Modul-Einbinden wird kein Diff benötigt, nur der aktuelle Zustand wird als Snapshot eingefroren.
    version = save_version(child_recipe, {}, user_id, db)

    component = RecipeComponent(
        parent_recipe_id=parent_recipe_id,
        child_recipe_id=child_recipe_id,
        sort_order=sort_order,
        flatten_into_parent=flatten_into_parent,
        servings_override=servings_override,
        scale_factor=Decimal(str(scale_factor)) if scale_factor is not None else None,
        referenced_version_id=version.id,
    )
    db.add(component)
    return component

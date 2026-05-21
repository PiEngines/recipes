from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user, require_chefkoch_or_above
from app.database import get_db
from app.models import Recipe, User
from app.models.recipe import RecipeVersion
from app.models.user import UserRole

router = APIRouter(prefix="/api/recipes", tags=["recipe_versions"])


# ── Recipes list for version-control dropdown (before /{recipe_id}/versions) ──

@router.get("/versions/recipes-list")
def list_recipes_for_versions(
    db: Session = Depends(get_db),
    _: User = Depends(require_chefkoch_or_above),
):
    recipes = (
        db.query(Recipe)
        .options(joinedload(Recipe.author))
        .filter(Recipe.deleted_at.is_(None))
        .order_by(Recipe.title)
        .all()
    )
    return [
        {
            "id": r.id,
            "title": r.title,
            "author": r.author.name if r.author else None,
        }
        for r in recipes
    ]


@router.post("/{recipe_id}/snapshot", status_code=201)
def create_snapshot(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")
    is_author = (
        recipe.author_id == current_user.id or recipe.created_by == current_user.id
    )
    if current_user.role not in (UserRole.kuechenchef, UserRole.chefkoch, UserRole.admin) and not is_author:
        raise HTTPException(status_code=403, detail="Zugriff verweigert")

    from app.versioning import _recipe_snapshot, save_version
    snapshot = _recipe_snapshot(recipe)
    save_version(recipe, snapshot, current_user.id, db)
    db.commit()
    return {"detail": "Snapshot gespeichert"}


@router.get("/{recipe_id}/versions")
def list_versions(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")
    is_author = (
        recipe.author_id == current_user.id or recipe.created_by == current_user.id
    )
    if current_user.role not in (UserRole.kuechenchef, UserRole.chefkoch, UserRole.admin) and not is_author:
        raise HTTPException(status_code=403, detail="Zugriff verweigert")

    versions = (
        db.query(RecipeVersion)
        .filter(RecipeVersion.recipe_id == recipe_id)
        .order_by(RecipeVersion.version_number.desc())
        .all()
    )
    return [
        {
            "id": v.id,
            "version_number": v.version_number,
            "changed_fields_count": v.changed_fields_count,
            "changed_chars_count": v.changed_chars_count,
            "created_by": v.created_by,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in versions
    ]


@router.get("/{recipe_id}/versions/{version_id}")
def get_version(
    recipe_id: int,
    version_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")
    is_author = (
        recipe.author_id == current_user.id or recipe.created_by == current_user.id
    )
    if current_user.role not in (UserRole.kuechenchef, UserRole.chefkoch, UserRole.admin) and not is_author:
        raise HTTPException(status_code=403, detail="Zugriff verweigert")

    ver = (
        db.query(RecipeVersion)
        .filter(
            RecipeVersion.id == version_id,
            RecipeVersion.recipe_id == recipe_id,
        )
        .first()
    )
    if not ver:
        raise HTTPException(status_code=404, detail="Version nicht gefunden")
    return {
        "id": ver.id,
        "version_number": ver.version_number,
        "snapshot": ver.snapshot,
        "changed_fields_count": ver.changed_fields_count,
        "changed_chars_count": ver.changed_chars_count,
        "created_by": ver.created_by,
        "created_at": ver.created_at.isoformat() if ver.created_at else None,
    }


@router.post("/{recipe_id}/versions/{version_id}/restore")
def restore_version(
    recipe_id: int,
    version_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in (UserRole.kuechenchef, UserRole.chefkoch, UserRole.admin):
        raise HTTPException(status_code=403, detail="Nur Chefköche können Versionen wiederherstellen")

    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")

    ver = (
        db.query(RecipeVersion)
        .filter(
            RecipeVersion.id == version_id,
            RecipeVersion.recipe_id == recipe_id,
        )
        .first()
    )
    if not ver:
        raise HTTPException(status_code=404, detail="Version nicht gefunden")

    from app.versioning import _recipe_snapshot, save_version

    # Save current state before restoring
    save_version(recipe, _recipe_snapshot(recipe), current_user.id, db)

    snap = ver.snapshot
    recipe.title = snap.get("title") or recipe.title
    recipe.description = snap.get("description")
    recipe.prep_time = snap.get("prep_time")
    recipe.cook_time = snap.get("cook_time")
    recipe.servings = snap.get("servings")
    recipe.difficulty = snap.get("difficulty")
    recipe.source = snap.get("source")
    db.commit()
    return {"detail": "Version wiederhergestellt"}

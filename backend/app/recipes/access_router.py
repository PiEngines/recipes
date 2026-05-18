import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_koch_or_above
from app.database import get_db
from app.email_service import send_recipe_share_email
from app.models import Recipe, User
from app.models.access import RecipeAccess
from app.models.user import UserRole

router = APIRouter(prefix="/api/recipes", tags=["recipe_access"])


class AccessCreate(BaseModel):
    access_type: str  # 'free_for_all' | 'individual'
    email: str | None = None
    expires_days: int | None = None


class AccessPatch(BaseModel):
    expires_days: int | None = None
    ohne_limit: bool = False


def _check_manage_permission(recipe: Recipe, current_user: User) -> None:
    if current_user.role not in (UserRole.chefkoch, UserRole.admin) and recipe.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Keine Berechtigung")


@router.post("/{recipe_id}/access")
def create_access(
    recipe_id: int,
    body: AccessCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_koch_or_above),
    db: Session = Depends(get_db),
):
    from app.config import settings

    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.deleted_at.is_(None)).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")
    _check_manage_permission(recipe, current_user)

    token_str = None
    expires_at = None
    if body.expires_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_days)

    if body.access_type == "individual":
        token_str = secrets.token_urlsafe(32)
        if body.email:
            recipe_url = f"{settings.app_url}/recipes/{recipe_id}"
            background_tasks.add_task(
                send_recipe_share_email,
                body.email,
                recipe.title,
                current_user.name,
                recipe_url,
            )

    access = RecipeAccess(
        recipe_id=recipe_id,
        access_type=body.access_type,
        email=body.email,
        token=token_str,
        expires_at=expires_at,
        created_by=current_user.id,
        is_pending_review=(recipe.review_status == "pending"),
    )
    db.add(access)
    db.commit()
    db.refresh(access)
    return _serialize(access)


@router.get("/{recipe_id}/access")
def list_access(
    recipe_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_koch_or_above),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.deleted_at.is_(None)).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")
    _check_manage_permission(recipe, current_user)

    q = db.query(RecipeAccess).filter(RecipeAccess.recipe_id == recipe_id)
    total = q.count()
    entries = q.order_by(RecipeAccess.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [_serialize(a) for a in entries],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


@router.delete("/{recipe_id}/access/{access_id}", status_code=204)
def delete_access(
    recipe_id: int,
    access_id: int,
    current_user: User = Depends(require_koch_or_above),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.deleted_at.is_(None)).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")
    _check_manage_permission(recipe, current_user)

    entry = (
        db.query(RecipeAccess)
        .filter(RecipeAccess.id == access_id, RecipeAccess.recipe_id == recipe_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Zugriff nicht gefunden")
    db.delete(entry)
    db.commit()


@router.post("/{recipe_id}/access/{access_id}/decline", status_code=200)
def decline_access(
    recipe_id: int,
    access_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(RecipeAccess)
        .filter(
            RecipeAccess.id == access_id,
            RecipeAccess.recipe_id == recipe_id,
            RecipeAccess.email == current_user.email,
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Freigabe nicht gefunden")
    if entry.declined_at:
        raise HTTPException(status_code=400, detail="Bereits abgelehnt")

    entry.declined_at = datetime.now(timezone.utc)
    entry.declined_by = current_user.id
    db.commit()
    return {"detail": "Freigabe abgelehnt"}


@router.patch("/{recipe_id}/access/{access_id}")
def update_access(
    recipe_id: int,
    access_id: int,
    body: AccessPatch,
    current_user: User = Depends(require_koch_or_above),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.deleted_at.is_(None)).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")
    _check_manage_permission(recipe, current_user)

    entry = (
        db.query(RecipeAccess)
        .filter(RecipeAccess.id == access_id, RecipeAccess.recipe_id == recipe_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Zugriff nicht gefunden")

    if body.ohne_limit:
        entry.expires_at = None
    elif body.expires_days is not None:
        entry.expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_days)

    db.commit()
    db.refresh(entry)
    return _serialize(entry)


def _serialize(a: RecipeAccess) -> dict:
    return {
        "id": a.id,
        "recipe_id": a.recipe_id,
        "access_type": a.access_type,
        "email": a.email,
        "token": a.token,
        "expires_at": a.expires_at.isoformat() if a.expires_at else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "declined_at": a.declined_at.isoformat() if a.declined_at else None,
        "is_pending_review": bool(a.is_pending_review),
    }

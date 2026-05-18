import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.database import get_db
from app.email_service import send_invitation_email
from app.models import Recipe, User
from app.models.access import RecipeAccess

router = APIRouter(prefix="/api/recipes", tags=["recipe_access"])


class AccessCreate(BaseModel):
    access_type: str  # 'free_for_all' | 'individual'
    email: str | None = None
    expires_days: int | None = None


@router.post("/{recipe_id}/access")
def create_access(
    recipe_id: int,
    body: AccessCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")

    token_str = None
    expires_at = None
    if body.expires_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_days)

    if body.access_type == "individual":
        token_str = secrets.token_urlsafe(32)
        if body.email:
            background_tasks.add_task(
                send_invitation_email, body.email, token_str, current_user.name, recipe.title
            )

    access = RecipeAccess(
        recipe_id=recipe_id,
        access_type=body.access_type,
        email=body.email,
        token=token_str,
        expires_at=expires_at,
        created_by=current_user.id,
    )
    db.add(access)
    db.commit()
    db.refresh(access)
    return {
        "id": access.id,
        "recipe_id": access.recipe_id,
        "access_type": access.access_type,
        "email": access.email,
        "token": access.token,
        "expires_at": access.expires_at.isoformat() if access.expires_at else None,
    }


@router.get("/{recipe_id}/access")
def list_access(
    recipe_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    entries = db.query(RecipeAccess).filter(RecipeAccess.recipe_id == recipe_id).all()
    return [
        {
            "id": a.id,
            "access_type": a.access_type,
            "email": a.email,
            "token": a.token,
            "expires_at": a.expires_at.isoformat() if a.expires_at else None,
        }
        for a in entries
    ]


@router.delete("/{recipe_id}/access/{access_id}", status_code=204)
def delete_access(
    recipe_id: int,
    access_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(RecipeAccess)
        .filter(
            RecipeAccess.id == access_id,
            RecipeAccess.recipe_id == recipe_id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Zugriff nicht gefunden")
    db.delete(entry)
    db.commit()

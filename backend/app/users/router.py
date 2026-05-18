from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_admin
from app.auth.password import hash_password, verify_password
from app.database import get_db
from app.email_service import send_welcome_email
from app.models import Recipe, User
from app.models.user import UserRole

router = APIRouter(prefix="/api/users", tags=["users"])
admin_router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserListItem(BaseModel):
    id: int
    name: str
    email: str
    role: str
    status: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PatchMeBody(BaseModel):
    name: str | None = None
    email: str | None = None
    email_notifications: bool | None = None
    dark_mode_preference: str | None = None


class DeleteMeBody(BaseModel):
    recipe_action: str  # 'delete' | 'keep' | 'transfer'
    transfer_to_user_id: int | None = None


class PatchRoleBody(BaseModel):
    role: str


# ── List users (admin) ────────────────────────────────────────────────────────

@router.get("", response_model=list[UserListItem])
def list_users(
    status: str | None = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if status is not None:
        q = q.filter(User.status == status)
    return q.order_by(User.created_at.desc()).all()


# ── Admin stats ───────────────────────────────────────────────────────────────

@admin_router.get("/stats")
def admin_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users_count = db.query(User).filter(User.deleted_at.is_(None)).count()
    recipes_count = db.query(Recipe).filter(Recipe.deleted_at.is_(None)).count()
    pending_users = db.query(User).filter(User.status == "pending").count()
    pending_reviews = db.query(Recipe).filter(Recipe.review_status == "pending").count()
    return {
        "users_count": users_count,
        "recipes_count": recipes_count,
        "pending_users": pending_users,
        "pending_reviews": pending_reviews,
    }


# ── Patch current user ────────────────────────────────────────────────────────

@router.patch("/me", response_model=UserListItem)
def patch_me(
    body: PatchMeBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.name is not None:
        if len(body.name.strip()) < 2:
            raise HTTPException(status_code=400, detail="Name muss mind. 2 Zeichen haben")
        current_user.name = body.name.strip()
    if body.email is not None:
        email = body.email.lower().strip()
        existing = db.query(User).filter(User.email == email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email bereits vergeben")
        current_user.email = email
    if body.email_notifications is not None:
        current_user.email_notifications = body.email_notifications
    if body.dark_mode_preference is not None:
        current_user.dark_mode_preference = body.dark_mode_preference
    db.commit()
    db.refresh(current_user)
    return current_user


# ── Delete current user (self-delete) ────────────────────────────────────────

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    body: DeleteMeBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.recipe_action not in ("delete", "keep", "transfer"):
        raise HTTPException(status_code=400, detail="Ungültige recipe_action")

    now = datetime.now(timezone.utc)

    if body.recipe_action == "delete":
        db.query(Recipe).filter(Recipe.created_by == current_user.id).update({"deleted_at": now})
    elif body.recipe_action == "keep":
        # Reassign to garbage collector user
        gc = db.query(User).filter(User.email == "system@piengines.internal").first()
        if gc:
            db.query(Recipe).filter(Recipe.created_by == current_user.id).update({"created_by": gc.id})
    elif body.recipe_action == "transfer":
        if not body.transfer_to_user_id:
            raise HTTPException(status_code=400, detail="transfer_to_user_id erforderlich")
        target = db.query(User).filter(User.id == body.transfer_to_user_id, User.is_active.is_(True)).first()
        if not target:
            raise HTTPException(status_code=404, detail="Zielbenutzer nicht gefunden")
        db.query(Recipe).filter(Recipe.created_by == current_user.id).update({"created_by": body.transfer_to_user_id})

    current_user.deleted_at = now
    current_user.status = "deleted"
    current_user.is_active = False
    db.commit()


# ── Patch role (admin) ────────────────────────────────────────────────────────

@router.patch("/{user_id}/role", response_model=UserListItem)
def patch_role(
    user_id: int,
    body: PatchRoleBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    allowed_roles = [r.value for r in UserRole]
    if body.role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Ungültige Rolle. Erlaubt: {allowed_roles}")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    user.role = UserRole(body.role)
    db.commit()
    db.refresh(user)
    return user


# ── Activate user (admin) ─────────────────────────────────────────────────────

@router.patch("/{user_id}/activate", response_model=UserListItem)
def activate_user(
    user_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    user.status = "active"
    user.is_active = True
    db.commit()
    db.refresh(user)
    background_tasks.add_task(send_welcome_email, user.email, user.name)
    return user


# ── Soft-delete user (admin) ──────────────────────────────────────────────────

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def soft_delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Eigenen Account nicht löschbar")

    now = datetime.now(timezone.utc)
    user.deleted_at = now
    user.status = "deleted"
    user.is_active = False

    # Soft delete user's recipes
    db.query(Recipe).filter(Recipe.created_by == user_id).update({"deleted_at": now})
    db.commit()


# ── Restore user (admin) ──────────────────────────────────────────────────────

@router.post("/{user_id}/restore", status_code=status.HTTP_200_OK)
def restore_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    if not user.deleted_at:
        raise HTTPException(status_code=400, detail="Benutzer nicht gelöscht")

    user.deleted_at = None
    user.status = "active"
    user.is_active = True

    # Restore recipes
    db.query(Recipe).filter(Recipe.created_by == user_id).update({"deleted_at": None})
    db.commit()
    return {"detail": "Benutzer wiederhergestellt"}

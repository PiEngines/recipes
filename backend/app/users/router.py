import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_kuechenchef, require_chefkoch_or_above
from app.auth.password import hash_password, verify_password
from app.database import get_db
from app.email_service import send_verification_email, send_welcome_email
from app.models import Recipe, User
from app.models.user import UserRole

router = APIRouter(prefix="/api/users", tags=["users"])
admin_router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Helpers ───────────────────────────────────────────────────────────────────

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_-]{3,30}$")


def _validate_username(username: str, db: Session, exclude_user_id: int | None = None) -> str:
    name = username.strip()
    if not _USERNAME_RE.match(name):
        raise HTTPException(
            status_code=400,
            detail="Username muss 3-30 Zeichen lang sein und darf nur a-z, A-Z, 0-9, _ und - enthalten",
        )
    query = db.query(User).filter(User.username == name)
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)
    if query.first() is not None:
        raise HTTPException(status_code=409, detail="Username bereits vergeben")
    return name


def _is_disposable(email: str, db: Session) -> bool:
    from app.models.access import DisposableEmailDomain

    domain = email.lower().split("@")[-1] if "@" in email else email
    return (
        db.query(DisposableEmailDomain)
        .filter(DisposableEmailDomain.domain == domain)
        .first()
        is not None
    )


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserListItem(BaseModel):
    id: int
    name: str
    email: str
    username: str | None = None
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


class PatchUsernameBody(BaseModel):
    username: str


class ActivateUserBody(BaseModel):
    role: str = "kuechenhilfe"


# ── List users (chefkoch) ─────────────────────────────────────────────────────

@router.get("", response_model=list[UserListItem])
def list_users(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_chefkoch_or_above),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if status is not None:
        q = q.filter(User.status == status)
    return q.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()


# ── Admin stats ───────────────────────────────────────────────────────────────

@admin_router.get("/stats")
def admin_stats(
    current_user: User = Depends(require_chefkoch_or_above),
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
        if _is_disposable(email, db):
            raise HTTPException(status_code=400, detail="Wegwerf-Email-Adressen sind nicht erlaubt")
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

    from app.models.access import RecipeAccess
    db.query(RecipeAccess).filter(RecipeAccess.email == current_user.email).delete()

    current_user.deleted_at = now
    current_user.status = "deleted"
    current_user.is_active = False
    db.commit()


# ── Patch role (chefkoch) ─────────────────────────────────────────────────────

@router.patch("/{user_id}/role", response_model=UserListItem)
def patch_role(
    user_id: int,
    body: PatchRoleBody,
    current_user: User = Depends(require_kuechenchef),
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


# ── Patch username (kuechenchef) ──────────────────────────────────────────────

@router.patch("/{user_id}/username", response_model=UserListItem)
def patch_username(
    user_id: int,
    body: PatchUsernameBody,
    current_user: User = Depends(require_kuechenchef),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    user.username = _validate_username(body.username, db, exclude_user_id=user.id)
    db.commit()
    db.refresh(user)
    return user


# ── Activate user (chefkoch) ──────────────────────────────────────────────────

@router.patch("/{user_id}/activate")
def activate_user(
    user_id: int,
    body: ActivateUserBody,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_chefkoch_or_above),
    db: Session = Depends(get_db),
):
    from app.models.tokens import EmailVerificationToken

    if current_user.role in (UserRole.kuechenchef, UserRole.admin):
        allowed_roles = ["kuechenhilfe", "koch", "chefkoch", "kuechenchef"]
    else:
        allowed_roles = ["kuechenhilfe", "koch", "chefkoch"]
    if body.role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Ungültige Rolle. Erlaubt: {allowed_roles}")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    user.role = UserRole(body.role)
    db.commit()

    # Guard against duplicate emails on repeated clicks
    existing_token = (
        db.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used_at.is_(None),
            EmailVerificationToken.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if existing_token:
        return {"message": "Verifikations-Email wurde bereits gesendet."}

    token_str = secrets.token_urlsafe(32)
    ev_token = EmailVerificationToken(
        token=token_str,
        user_id=user.id,
        was_invited=True,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(ev_token)
    db.commit()
    background_tasks.add_task(send_verification_email, user.email, user.name, token_str)
    return {"message": "Verifikations-Email gesendet"}


# ── Soft-delete user (chefkoch) ───────────────────────────────────────────────

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def soft_delete_user(
    user_id: int,
    current_user: User = Depends(require_kuechenchef),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Eigenen Account nicht löschbar")

    from app.models.access import RecipeAccess

    now = datetime.now(timezone.utc)
    db.query(RecipeAccess).filter(RecipeAccess.email == user.email).delete()

    user.deleted_at = now
    user.status = "deleted"
    user.is_active = False

    # Soft delete user's recipes
    db.query(Recipe).filter(Recipe.created_by == user_id).update({"deleted_at": now})
    db.commit()


# ── Restore user (chefkoch) ───────────────────────────────────────────────────

@router.post("/{user_id}/restore", status_code=status.HTTP_200_OK)
def restore_user(
    user_id: int,
    current_user: User = Depends(require_kuechenchef),
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


# ── Shared recipes for current user ──────────────────────────────────────────

@router.get("/me/shared-recipes")
def get_shared_recipes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.access import RecipeAccess
    from sqlalchemy import or_

    now = datetime.now(timezone.utc)

    # Collect valid access entries for current user's email
    accesses = db.query(RecipeAccess).filter(
        RecipeAccess.email == current_user.email,
        RecipeAccess.declined_at.is_(None),
        or_(RecipeAccess.expires_at.is_(None), RecipeAccess.expires_at > now),
    ).all()

    # Deduplicate by recipe_id (keep first match)
    access_map = {}
    for a in accesses:
        if a.recipe_id not in access_map:
            access_map[a.recipe_id] = a

    recipe_ids = list(access_map.keys())
    if not recipe_ids:
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "pages": 1}

    total = db.query(Recipe).filter(Recipe.id.in_(recipe_ids), Recipe.deleted_at.is_(None)).count()
    recipes = (
        db.query(Recipe)
        .filter(Recipe.id.in_(recipe_ids), Recipe.deleted_at.is_(None))
        .order_by(Recipe.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    creator_ids = {r.created_by for r in recipes}
    creators = {}
    if creator_ids:
        creators = {u.id: u.name for u in db.query(User).filter(User.id.in_(creator_ids)).all()}

    return {
        "items": [
            {
                "id": r.id,
                "title": r.title,
                "description": r.description,
                "status": str(r.status),
                "created_at": r.created_at.isoformat(),
                "access_id": access_map[r.id].id,
                "expires_at": access_map[r.id].expires_at.isoformat() if access_map[r.id].expires_at else None,
                "shared_by_name": creators.get(r.created_by, "Unbekannt"),
                "is_pending_review": bool(access_map[r.id].is_pending_review),
            }
            for r in recipes
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
    }

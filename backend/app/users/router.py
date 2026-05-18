from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.database import get_db
from app.models import Recipe, User

router = APIRouter(prefix="/api/users", tags=["users"])


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

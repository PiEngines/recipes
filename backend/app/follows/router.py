"""Follow-Graph (F3a/Commit 2).

  POST   /api/users/{user_id}/follow      – folgen (idempotent, 204)
  DELETE /api/users/{user_id}/follow      – entfolgen (idempotent, 204)
  GET    /api/users/{user_id}/followers   – wer folgt diesem User
  GET    /api/users/{user_id}/following   – wem folgt dieser User
  GET    /api/users/{user_id}/profile     – Profilsicht inkl. Follow-Zahlen

Der Profil-Endpoint ist neu: bis F3a gab es keinen Profil-Read, die
Profilseite baute sich allein aus /api/recipes?author_id=. Er ist damit der
Ort, an dem bio und die Follow-Zahlen zusammenlaufen.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_koch_or_above
from app.database import get_db
from app.follows.schemas import FollowUserItem, FollowUserPage, UserProfile
from app.models import User, UserFollow
from app.pins.router import resolve_pins

router = APIRouter(prefix="/api/users", tags=["follows"])


def _active_user_or_404(db: Session, user_id: int) -> User:
    user = (
        db.query(User)
        .filter(User.id == user_id, User.deleted_at.is_(None))
        .first()
    )
    if user is None:
        raise HTTPException(status_code=404, detail="Nutzer nicht gefunden")
    return user


def _follower_count(db: Session, user_id: int) -> int:
    return db.query(UserFollow).filter(UserFollow.followee_id == user_id).count()


def _following_count(db: Session, user_id: int) -> int:
    return db.query(UserFollow).filter(UserFollow.follower_id == user_id).count()


def _is_following(db: Session, follower_id: int, followee_id: int) -> bool:
    return db.query(
        db.query(UserFollow)
        .filter(UserFollow.follower_id == follower_id, UserFollow.followee_id == followee_id)
        .exists()
    ).scalar()


@router.post("/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
def follow_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Man kann sich nicht selbst folgen")
    _active_user_or_404(db, user_id)

    db.add(UserFollow(follower_id=current_user.id, followee_id=user_id))
    try:
        db.commit()
    except IntegrityError:
        # Folgt bereits (auch bei parallelem Doppelklick) — idempotent.
        db.rollback()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
def unfollow_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    db.query(UserFollow).filter(
        UserFollow.follower_id == current_user.id,
        UserFollow.followee_id == user_id,
    ).delete()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _page(db: Session, query, page: int, page_size: int) -> FollowUserPage:
    total = query.count()
    zeilen = (
        query.order_by(User.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return FollowUserPage(
        items=[FollowUserItem.model_validate(u) for u in zeilen],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{user_id}/followers", response_model=FollowUserPage)
def list_followers(
    user_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    _active_user_or_404(db, user_id)
    query = (
        db.query(User)
        .join(UserFollow, UserFollow.follower_id == User.id)
        .filter(UserFollow.followee_id == user_id, User.deleted_at.is_(None))
    )
    return _page(db, query, page, page_size)


@router.get("/{user_id}/following", response_model=FollowUserPage)
def list_following(
    user_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    _active_user_or_404(db, user_id)
    query = (
        db.query(User)
        .join(UserFollow, UserFollow.followee_id == User.id)
        .filter(UserFollow.follower_id == user_id, User.deleted_at.is_(None))
    )
    return _page(db, query, page, page_size)


@router.get("/{user_id}/profile", response_model=UserProfile)
def get_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    user = _active_user_or_404(db, user_id)
    return UserProfile(
        id=user.id,
        name=user.name,
        username=user.username,
        avatar_url=user.avatar_url,
        bio=user.bio,
        # Privat bleibt privat: die Vorlieben nur mitgeben, wenn der Nutzer sie
        # freigegeben hat — sonst gar nicht erst über die Leitung.
        preferences=user.preferences if user.preferences_public else None,
        # Ernährungsprofil (Ü18), jeweils hinter dem eigenen Toggle. Allergien
        # fehlen hier bewusst ganz — sie werden nie öffentlich.
        diet_labels=user.diet_labels if user.diet_public else [],
        exclusions=user.exclusions if user.exclusions_public else [],
        # Highlights sind zum Zeigen da — kein Gate.
        pinned=resolve_pins(db, user.id),
        follower_count=_follower_count(db, user.id),
        following_count=_following_count(db, user.id),
        # Sich selbst folgt man nie.
        is_following=(
            False if user.id == current_user.id
            else _is_following(db, current_user.id, user.id)
        ),
    )

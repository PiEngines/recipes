"""Profil-Pins — Highlights im Profilkopf (Ü18).

  GET  /api/users/me/pins   – eigene Pins (aufgelöst)
  PUT  /api/users/me/pins   – Pins setzen/ordnen (ersetzt die Auswahl)

Bis zu drei Rezepte und drei Beiträge je User, jeweils eigene Inhalte. Der
Schreibweg läuft immer über den angemeldeten User — fremde Pins sind so gar
nicht erst adressierbar. Aufgelöst wird nach dem Muster von `_resolve_items`
der Sammlungen; fehlende Ziele werden beim Lesen übersprungen.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload, subqueryload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.external_posts.schemas import ExternalPostPublic
from app.models import ExternalPost, Recipe, User, UserPin
from app.models.user_pin import PinItemType
from app.pins.schemas import MAX_PRO_TYP, PinnedContent, PinsUpdate
from app.recipes.router import _attach_primary_images, _attach_ratings
from app.recipes.schemas import RecipeListItem

router = APIRouter(prefix="/api/users/me/pins", tags=["pins"])


def resolve_pins(db: Session, user_id: int) -> PinnedContent:
    """Die Pins eines Users in `sort_order` auflösen — Rezepte und Beiträge
    getrennt, je Typ batch-geladen. Ziele, die inzwischen fehlen, entfallen
    (die polymorphe Spalte hat bewusst keinen Fremdschlüssel)."""
    pins = (
        db.query(UserPin)
        .filter(UserPin.user_id == user_id)
        .order_by(UserPin.item_type, UserPin.sort_order, UserPin.id)
        .all()
    )
    if not pins:
        return PinnedContent()

    rezept_ids = [p.item_id for p in pins if p.item_type == PinItemType.recipe.value]
    post_ids = [p.item_id for p in pins if p.item_type == PinItemType.external_post.value]

    rezepte = {}
    if rezept_ids:
        rows = (
            db.query(Recipe)
            .filter(Recipe.id.in_(rezept_ids), Recipe.deleted_at.is_(None))
            .options(
                subqueryload(Recipe.categories),
                subqueryload(Recipe.tags),
                joinedload(Recipe.author),
            )
            .all()
        )
        _attach_primary_images(rows, db)
        _attach_ratings(rows, db)
        rezepte = {r.id: r for r in rows}

    posts = {}
    if post_ids:
        posts = {p.id: p for p in db.query(ExternalPost).filter(ExternalPost.id.in_(post_ids)).all()}

    # Reihenfolge aus den Pins beibehalten.
    recipe_out = [
        RecipeListItem.model_validate(rezepte[p.item_id])
        for p in pins
        if p.item_type == PinItemType.recipe.value and p.item_id in rezepte
    ]
    post_out = [
        ExternalPostPublic.model_validate(posts[p.item_id])
        for p in pins
        if p.item_type == PinItemType.external_post.value and p.item_id in posts
    ]
    return PinnedContent(recipes=recipe_out, posts=post_out)


def _eigene_ids(db: Session, modell, ids: list[int], user_id: int, label: str) -> list[int]:
    """Prüft: höchstens drei, keine Duplikate, existieren und gehören dem User.
    Highlights zeigen eigene Inhalte — Fremdes lässt sich nicht anpinnen."""
    eindeutig = list(dict.fromkeys(ids))
    if len(eindeutig) > MAX_PRO_TYP:
        raise HTTPException(status_code=422, detail=f"Höchstens {MAX_PRO_TYP} {label} anpinnbar")
    if not eindeutig:
        return []
    treffer = {
        r.id for r in db.query(modell.id).filter(
            modell.id.in_(eindeutig), modell.created_by == user_id
        ).all()
    }
    fehlt = [i for i in eindeutig if i not in treffer]
    if fehlt:
        raise HTTPException(status_code=422, detail=f"Nicht deine {label}: {fehlt}")
    return eindeutig


@router.get("", response_model=PinnedContent)
def get_own_pins(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return resolve_pins(db, current_user.id)


@router.put("", response_model=PinnedContent)
def set_pins(
    body: PinsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe_ids = _eigene_ids(db, Recipe, body.recipe_ids, current_user.id, "Rezepte")
    post_ids = _eigene_ids(db, ExternalPost, body.external_post_ids, current_user.id, "Beiträge")

    # Alte Pins ersetzen — komplette Neusetzung ist einfacher als ein Diff und
    # die Mengen sind winzig (≤3 je Typ).
    db.query(UserPin).filter(UserPin.user_id == current_user.id).delete()
    for reihe, rid in enumerate(recipe_ids):
        db.add(UserPin(user_id=current_user.id, item_type=PinItemType.recipe.value, item_id=rid, sort_order=reihe))
    for reihe, pid in enumerate(post_ids):
        db.add(UserPin(user_id=current_user.id, item_type=PinItemType.external_post.value, item_id=pid, sort_order=reihe))
    db.commit()

    return resolve_pins(db, current_user.id)

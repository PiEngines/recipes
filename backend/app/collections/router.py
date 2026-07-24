"""Mixed Collections (F3a/Commit 4).

  POST   /api/collections                                – anlegen
  GET    /api/collections                                – eigene Sammlungen
  GET    /api/collections/{id}                           – Items aufgelöst
  PATCH  /api/collections/{id}                           – Name/Sichtbarkeit
  DELETE /api/collections/{id}
  POST   /api/collections/{id}/items                     – Item hinzufügen
  DELETE /api/collections/{id}/items/{item_type}/{item_id}
  PATCH  /api/collections/{id}/reorder
  GET    /api/users/{user_id}/collections                – nur öffentliche

Sichtbarkeit: der Eigentümer sieht seine Sammlungen immer, Fremde nur bei
`visibility=public`. Eine private Sammlung ist für Fremde nicht von einer
nicht existierenden unterscheidbar (404, kein 403).

Eine Sammlung mischt Rezepte und External Posts; dasselbe Rezept darf in
beliebig vielen Sammlungen liegen, innerhalb einer Sammlung aber nur einmal.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, subqueryload

from app.auth.dependencies import require_koch_or_above
from app.collections.schemas import (
    CollectionCreate,
    CollectionDetail,
    CollectionItemAdd,
    CollectionPatch,
    CollectionSummary,
    ReorderEntry,
    ResolvedExternalPostItem,
    ResolvedRecipeItem,
)
from app.database import get_db
from app.external_posts.schemas import ExternalPostPublic
from app.models import (
    Collection,
    CollectionItem,
    CollectionItemType,
    ExternalPost,
    Recipe,
    User,
)
from app.models.recipe import RecipeStatus
from app.recipes.router import _attach_primary_images, _attach_ratings
from app.recipes.schemas import RecipeListItem

router = APIRouter(prefix="/api/collections", tags=["collections"])
# Profil-Sicht auf fremde Sammlungen — eigener Prefix.
user_router = APIRouter(prefix="/api/users", tags=["collections"])


def _item_count(db: Session, collection_id: int) -> int:
    return db.query(CollectionItem).filter(CollectionItem.collection_id == collection_id).count()


def _summary(db: Session, c: Collection) -> CollectionSummary:
    return CollectionSummary(
        id=c.id,
        name=c.name,
        visibility=c.visibility,
        created_by=c.created_by,
        item_count=_item_count(db, c.id),
        created_at=c.created_at,
    )


def _own_collection_or_404(db: Session, collection_id: int, user: User) -> Collection:
    c = (
        db.query(Collection)
        .filter(Collection.id == collection_id, Collection.created_by == user.id)
        .first()
    )
    if c is None:
        raise HTTPException(status_code=404, detail="Sammlung nicht gefunden")
    return c


def _readable_collection_or_404(db: Session, collection_id: int, user: User) -> Collection:
    c = db.query(Collection).filter(Collection.id == collection_id).first()
    if c is None:
        raise HTTPException(status_code=404, detail="Sammlung nicht gefunden")
    if c.created_by != user.id and c.visibility != "public":
        # Bewusst 404 statt 403: die Existenz einer privaten Sammlung ist selbst
        # eine Information.
        raise HTTPException(status_code=404, detail="Sammlung nicht gefunden")
    return c


def _recipe_exists(db: Session, recipe_id: int) -> bool:
    """Aktiv = veröffentlicht und nicht gelöscht (Drafts zählen nicht)."""
    return db.query(
        db.query(Recipe)
        .filter(
            Recipe.id == recipe_id,
            Recipe.deleted_at.is_(None),
            Recipe.status == RecipeStatus.published,
        )
        .exists()
    ).scalar()


def _external_post_exists(db: Session, post_id: int) -> bool:
    return db.query(db.query(ExternalPost).filter(ExternalPost.id == post_id).exists()).scalar()


def _resolve_items(db: Session, collection_id: int):
    """Items in `sort_order` auflösen — Rezepte und External Posts gemischt.

    Batch-Laden je Typ, damit die Auflösung nicht in ein N+1 läuft.
    Referenzen, deren Ziel inzwischen fehlt, werden übersprungen (die
    polymorphe Spalte hat bewusst keinen Fremdschlüssel).
    """
    eintraege = (
        db.query(CollectionItem)
        .filter(CollectionItem.collection_id == collection_id)
        .order_by(CollectionItem.sort_order, CollectionItem.id)
        .all()
    )
    if not eintraege:
        return []

    rezept_ids = [e.item_id for e in eintraege if e.item_type == CollectionItemType.recipe.value]
    post_ids = [e.item_id for e in eintraege if e.item_type == CollectionItemType.external_post.value]

    rezepte = {}
    if rezept_ids:
        # Kein deleted_at-Filter: soft-deleted Rezepte sollen grau erscheinen
        # (Konsistenz mit der Favoritenliste), statt aus der Sammlung zu
        # verschwinden. deleted_at/purge_after reisen über RecipeListItem mit;
        # nur physisch fehlende (bereits gepurgte) Zeilen überspringt die
        # `if r is None`-Schleife unten.
        rows = (
            db.query(Recipe)
            .filter(Recipe.id.in_(rezept_ids))
            .options(
                subqueryload(Recipe.categories),
                subqueryload(Recipe.tags),
                joinedload(Recipe.author),
            )
            .all()
        )
        # Gleiche Anreicherung wie in der Rezeptliste — kein Drift.
        _attach_primary_images(rows, db)
        _attach_ratings(rows, db)
        rezepte = {r.id: r for r in rows}

    posts = {}
    if post_ids:
        posts = {
            p.id: p
            for p in db.query(ExternalPost).filter(ExternalPost.id.in_(post_ids)).all()
        }

    ergebnis = []
    for e in eintraege:
        if e.item_type == CollectionItemType.recipe.value:
            r = rezepte.get(e.item_id)
            if r is None:
                continue
            ergebnis.append(ResolvedRecipeItem(
                item_id=e.item_id,
                sort_order=e.sort_order,
                recipe=RecipeListItem.model_validate(r),
            ))
        elif e.item_type == CollectionItemType.external_post.value:
            p = posts.get(e.item_id)
            if p is None:
                continue
            ergebnis.append(ResolvedExternalPostItem(
                item_id=e.item_id,
                sort_order=e.sort_order,
                external_post=ExternalPostPublic.model_validate(p),
            ))
    return ergebnis


# ── Sammlungen ───────────────────────────────────────────────────────────────

@router.post("", response_model=CollectionSummary, status_code=status.HTTP_201_CREATED)
def create_collection(
    body: CollectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    c = Collection(
        name=body.name.strip(),
        created_by=current_user.id,
        visibility=body.visibility.value,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _summary(db, c)


@router.get("", response_model=list[CollectionSummary])
def list_my_collections(
    contains_item_type: CollectionItemType | None = Query(None),
    contains_item_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    """Eigene Sammlungen.

    Mit `contains_item_type` *und* `contains_item_id` trägt jede Sammlung
    zusätzlich `contains`: liegt dieses Item darin? Das braucht der Picker, um
    „schon drin" anzuzeigen und zum Entfernen umzuschalten (BUG-20). Eine
    einzelne Zusatz-Query über alle Sammlungen, kein N+1. Ohne die Parameter
    bleibt `contains` `None` und die Antwort unverändert.
    """
    rows = (
        db.query(Collection)
        .filter(Collection.created_by == current_user.id)
        .order_by(Collection.created_at.desc(), Collection.id.desc())
        .all()
    )
    summaries = [_summary(db, c) for c in rows]

    if contains_item_type is not None and contains_item_id is not None:
        drin = {
            cid for (cid,) in db.query(CollectionItem.collection_id).filter(
                CollectionItem.collection_id.in_([c.id for c in rows] or [0]),
                CollectionItem.item_type == contains_item_type,
                CollectionItem.item_id == contains_item_id,
            )
        }
        for s in summaries:
            s.contains = s.id in drin

    return summaries


@router.get("/{collection_id}", response_model=CollectionDetail)
def get_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    c = _readable_collection_or_404(db, collection_id, current_user)
    basis = _summary(db, c)
    return CollectionDetail(**basis.model_dump(), items=_resolve_items(db, c.id))


@router.patch("/{collection_id}", response_model=CollectionSummary)
def patch_collection(
    collection_id: int,
    body: CollectionPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    c = _own_collection_or_404(db, collection_id, current_user)
    if body.name is not None:
        c.name = body.name.strip()
    if body.visibility is not None:
        c.visibility = body.visibility.value
    db.commit()
    db.refresh(c)
    return _summary(db, c)


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    c = _own_collection_or_404(db, collection_id, current_user)
    db.delete(c)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Items ────────────────────────────────────────────────────────────────────

@router.post("/{collection_id}/items", response_model=CollectionSummary, status_code=status.HTTP_201_CREATED)
def add_item(
    collection_id: int,
    body: CollectionItemAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    c = _own_collection_or_404(db, collection_id, current_user)

    if body.item_type == CollectionItemType.recipe:
        vorhanden = _recipe_exists(db, body.item_id)
    else:
        vorhanden = _external_post_exists(db, body.item_id)
    if not vorhanden:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")

    letzte = (
        db.query(func.max(CollectionItem.sort_order))
        .filter(CollectionItem.collection_id == c.id)
        .scalar()
    )
    db.add(CollectionItem(
        collection_id=c.id,
        item_type=body.item_type.value,
        item_id=body.item_id,
        sort_order=0 if letzte is None else letzte + 1,
    ))
    try:
        db.commit()
    except IntegrityError:
        # Liegt schon in dieser Sammlung — Dedup, kein Fehler.
        db.rollback()
    return _summary(db, c)


@router.delete(
    "/{collection_id}/items/{item_type}/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_item(
    collection_id: int,
    item_type: CollectionItemType,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    c = _own_collection_or_404(db, collection_id, current_user)
    db.query(CollectionItem).filter(
        CollectionItem.collection_id == c.id,
        CollectionItem.item_type == item_type.value,
        CollectionItem.item_id == item_id,
    ).delete()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{collection_id}/reorder", response_model=CollectionDetail)
def reorder_items(
    collection_id: int,
    body: list[ReorderEntry],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    c = _own_collection_or_404(db, collection_id, current_user)
    for eintrag in body:
        db.query(CollectionItem).filter(
            CollectionItem.collection_id == c.id,
            CollectionItem.item_type == eintrag.item_type.value,
            CollectionItem.item_id == eintrag.item_id,
        ).update({"sort_order": eintrag.sort_order})
    db.commit()
    basis = _summary(db, c)
    return CollectionDetail(**basis.model_dump(), items=_resolve_items(db, c.id))


# ── Profil-Sicht ─────────────────────────────────────────────────────────────

@user_router.get("/{user_id}/collections", response_model=list[CollectionSummary])
def list_public_collections(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    """Öffentliche Sammlungen eines Users — auch beim Blick aufs eigene Profil
    bewusst nur die öffentlichen, damit die Sicht der Profilsicht entspricht."""
    rows = (
        db.query(Collection)
        .filter(Collection.created_by == user_id, Collection.visibility == "public")
        .order_by(Collection.created_at.desc(), Collection.id.desc())
        .all()
    )
    return [_summary(db, c) for c in rows]

"""Kräuterschule Phase 4 – Endpoints (Recipes-Mapping + Freigabe).

Drei Routen in einem geschlossenen Block:
  GET   /api/recipes/{recipe_id}/plants   – Pflanzen in einem Rezept
  GET   /api/plants/{slug}/recipes         – Rezepte, die eine Pflanze verwenden
  PATCH /api/plants/{slug}/release          – redaktion_freigegeben setzen (Küchenchef/Admin)

Beide Cross-Endpoints werten DIESELBE Relation ueber ingredient_resolver.py aus
(symmetrisch). Sichtbarkeit wird pro Domaene lokal gegatet:
  - Rezepte: _apply_visibility_filter (aus recipes.router wiederverwendet, kein Drift)
  - Pflanzen: redaktion_freigegeben + can_view_unreleased
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user, require_kuechenchef
from app.database import get_db
from app.models import Ingredient, Plant, Recipe, User
from app.models.plant_ingredient_map import PlantIngredientMap
from app.plants.ingredient_map_schemas import (
    PlantMatchItem,
    PlantRecipesResponse,
    PlantReleaseResponse,
    PlantReleaseUpdate,
    RecipeMatchItem,
    RecipePlantsResponse,
)
from app.plants.ingredient_resolver import canonical_tokens, match_typ
from app.plants.permissions import can_view_plants, can_view_unreleased
# Wiederverwendung der bestehenden Rezept-Sichtbarkeitslogik (single source of truth)
from app.recipes.router import _apply_visibility_filter

router = APIRouter(prefix="/api", tags=["plants-recipes"])


# ── Rezept -> Pflanzen ────────────────────────────────────────────────────────
@router.get("/recipes/{recipe_id}/plants", response_model=RecipePlantsResponse)
def get_recipe_plants(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not can_view_plants(current_user):
        raise HTTPException(status_code=403, detail="Kein Zugriff auf Pflanzendaten")

    # Rezept nur, wenn fuer den User sichtbar (404-statt-403-Leakschutz).
    q = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.deleted_at.is_(None))
    q = _apply_visibility_filter(q, current_user, db)
    recipe = q.first()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")

    # Tokens aller Zutaten sammeln; je Token merken, ob er exakt vorkam.
    token_exact: dict[str, bool] = {}
    for ing in recipe.ingredients:
        norm_tokens = canonical_tokens(ing.name)
        for t in norm_tokens:
            exact_here = match_typ(ing.name, {t}) == "exakt"
            token_exact[t] = token_exact.get(t, False) or exact_here
    if not token_exact:
        return RecipePlantsResponse(recipe_id=recipe_id, plants=[])

    map_q = (
        db.query(PlantIngredientMap.token, Plant)
        .join(Plant, PlantIngredientMap.pflanzen_id == Plant.id)
        .filter(PlantIngredientMap.token.in_(list(token_exact.keys())))
    )
    if not can_view_unreleased(current_user):
        map_q = map_q.filter(Plant.redaktion_freigegeben.is_(True))

    # Pro Pflanze aggregieren: Canonicals sammeln, exakt schlaegt synonym.
    by_plant: dict[str, dict] = {}
    for token, plant in map_q.all():
        entry = by_plant.setdefault(plant.id, {"plant": plant, "canonicals": set(), "exact": False})
        entry["canonicals"].add(token)
        if token_exact.get(token):
            entry["exact"] = True

    plants = [
        PlantMatchItem(
            id=e["plant"].id,
            slug=e["plant"].slug,
            deutscher_name=e["plant"].deutscher_name,
            bild_dateiname=e["plant"].bild_dateiname,
            essbarkeit=e["plant"].essbarkeit,
            warnung=e["plant"].warnung,
            match_typ="exakt" if e["exact"] else "synonym",
            canonicals=sorted(e["canonicals"]),
        )
        for e in by_plant.values()
    ]
    plants.sort(key=lambda p: p.deutscher_name)
    return RecipePlantsResponse(recipe_id=recipe_id, plants=plants)


# ── Pflanze -> Rezepte ────────────────────────────────────────────────────────
@router.get("/plants/{slug}/recipes", response_model=PlantRecipesResponse)
def get_plant_recipes(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not can_view_plants(current_user):
        raise HTTPException(status_code=403, detail="Kein Zugriff auf Pflanzendaten")

    plant = db.query(Plant).filter(Plant.slug == slug).first()
    if plant is None or (not plant.redaktion_freigegeben and not can_view_unreleased(current_user)):
        raise HTTPException(status_code=404, detail="Pflanze nicht gefunden")

    tokens = {t for (t,) in db.query(PlantIngredientMap.token).filter(
        PlantIngredientMap.pflanzen_id == plant.id
    ).all()}
    if not tokens:
        return PlantRecipesResponse(slug=slug, recipes=[])

    # Kandidaten-Vorfilter in SQL (schmale Trefferschmenge), dann deterministische
    # Bestaetigung in Python ueber denselben Resolver -> symmetrisch zur Gegenrichtung.
    visible = _apply_visibility_filter(
        db.query(Ingredient.recipe_id, Ingredient.name)
        .join(Recipe, Ingredient.recipe_id == Recipe.id)
        .filter(Recipe.deleted_at.is_(None)),
        current_user, db,
    )
    like_clauses = [Ingredient.name.ilike(f"%{t}%") for t in tokens]
    candidates = visible.filter(or_(*like_clauses)).all()

    by_recipe: dict[int, dict] = {}
    for recipe_id, name in candidates:
        inter = canonical_tokens(name) & tokens
        if not inter:
            continue
        entry = by_recipe.setdefault(recipe_id, {"canonicals": set(), "exact": False})
        entry["canonicals"] |= inter
        if match_typ(name, tokens) == "exakt":
            entry["exact"] = True
    if not by_recipe:
        return PlantRecipesResponse(slug=slug, recipes=[])

    recipe_rows = (
        db.query(Recipe)
        .options(joinedload(Recipe.author))
        .filter(Recipe.id.in_(by_recipe.keys()))
        .all()
    )
    recipes = [
        RecipeMatchItem(
            id=r.id,
            title=r.title,
            type=r.type,
            thumbnail_style=r.thumbnail_style,
            author_name=r.author.name if r.author else None,
            match_typ="exakt" if by_recipe[r.id]["exact"] else "synonym",
            canonicals=sorted(by_recipe[r.id]["canonicals"]),
        )
        for r in recipe_rows
    ]
    recipes.sort(key=lambda r: r.title.lower())
    return PlantRecipesResponse(slug=slug, recipes=recipes)


# ── Redaktionelle Freigabe ────────────────────────────────────────────────────
@router.patch("/plants/{slug}/release", response_model=PlantReleaseResponse)
def set_plant_release(
    slug: str,
    body: PlantReleaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_kuechenchef),
):
    plant = db.query(Plant).filter(Plant.slug == slug).first()
    if plant is None:
        raise HTTPException(status_code=404, detail="Pflanze nicht gefunden")
    plant.redaktion_freigegeben = body.freigegeben
    db.commit()
    return PlantReleaseResponse(slug=slug, redaktion_freigegeben=plant.redaktion_freigegeben)

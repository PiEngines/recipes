"""Kräuterschule Phase 4 – Response-Schemas.

Gemeinsame Response-Form fuer beide Richtungen: jede Zeile traegt match_typ
('exakt' | 'synonym') + die ausloesenden Canonicals, damit spaetere Fuzzy-Treffer
transparent kennzeichenbar sind.
"""
from pydantic import BaseModel


class PlantMatchItem(BaseModel):
    """Eine Pflanze, die in einem Rezept vorkommt."""
    id: str
    slug: str
    deutscher_name: str
    bild_dateiname: str | None = None
    essbarkeit: str
    warnung: str | None = None
    match_typ: str          # 'exakt' | 'synonym'
    canonicals: list[str]   # die ausloesenden Tokens


class RecipeMatchItem(BaseModel):
    """Ein Rezept, das eine bestimmte Pflanze verwendet (schlankes DTO)."""
    id: int
    title: str
    type: str = "kochen"
    thumbnail_style: str = "crop"
    author_name: str | None = None
    match_typ: str          # 'exakt' | 'synonym'
    canonicals: list[str]


class RecipePlantsResponse(BaseModel):
    recipe_id: int
    plants: list[PlantMatchItem] = []


class PlantRecipesResponse(BaseModel):
    slug: str
    recipes: list[RecipeMatchItem] = []


class PlantReleaseUpdate(BaseModel):
    freigegeben: bool


class PlantReleaseResponse(BaseModel):
    slug: str
    redaktion_freigegeben: bool

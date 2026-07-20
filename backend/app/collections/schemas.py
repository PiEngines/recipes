from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.external_posts.schemas import ExternalPostItem
from app.models.collection import CollectionItemType, CollectionVisibility
from app.recipes.schemas import RecipeListItem


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    visibility: CollectionVisibility = CollectionVisibility.private


class CollectionPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    visibility: CollectionVisibility | None = None


class CollectionSummary(BaseModel):
    id: int
    name: str
    visibility: str
    created_by: int
    item_count: int
    created_at: datetime


class ResolvedRecipeItem(BaseModel):
    """Aufgelöstes Rezept in einer Sammlung."""

    item_type: Literal["recipe"] = "recipe"
    item_id: int
    sort_order: int
    recipe: RecipeListItem


class ResolvedExternalPostItem(BaseModel):
    """Aufgelöster External Post in einer Sammlung."""

    item_type: Literal["external_post"] = "external_post"
    item_id: int
    sort_order: int
    external_post: ExternalPostItem


class CollectionDetail(CollectionSummary):
    # Discriminator ist `item_type`; die Liste ist bewusst gemischt.
    items: list[ResolvedRecipeItem | ResolvedExternalPostItem] = []


class CollectionItemAdd(BaseModel):
    item_type: CollectionItemType
    item_id: int


class ReorderEntry(BaseModel):
    item_type: CollectionItemType
    item_id: int
    sort_order: int

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.external_posts.schemas import ExternalPostPublic
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
    # Nur gesetzt, wenn die Liste mit `contains_item_type`/`contains_item_id`
    # abgefragt wurde: liegt genau dieses Item in dieser Sammlung? Sonst `None`,
    # damit bestehende Aufrufer exakt dieselbe Antwort wie bisher bekommen.
    contains: bool | None = None


class ResolvedRecipeItem(BaseModel):
    """Aufgelöstes Rezept in einer Sammlung."""

    item_type: Literal["recipe"] = "recipe"
    item_id: int
    sort_order: int
    recipe: RecipeListItem


class ResolvedExternalPostItem(BaseModel):
    """Aufgelöster External Post in einer Sammlung.

    `ExternalPostPublic` statt `ExternalPostItem` wegen `oembed_html`: die
    Sammlungs-Detailseite spielt Beiträge ab, und der TikTok-Player entsteht
    ausschließlich aus diesem Markup (Instagram baut seinen iFrame dagegen aus
    der URL). Additiv — es kommt ein Feld dazu, keins fällt weg. Die private
    Arbeitsfläche des Autors (Caption, Zutaten, Rezept-Verknüpfung) bleibt
    weiterhin draußen.
    """

    item_type: Literal["external_post"] = "external_post"
    item_id: int
    sort_order: int
    external_post: ExternalPostPublic


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

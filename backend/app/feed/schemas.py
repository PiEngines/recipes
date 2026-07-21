"""Antwortform des globalen Feeds (F3b-3).

Ein Item ist ein getaggter Umschlag: `type` sagt, welches der optionalen
Nutzlast-Felder gefüllt ist. Die Nutzlasten selbst sind die bestehenden
Schemas — der Feed erfindet keine eigene Rezept- oder Beitragsform, damit
Frontend-Komponenten (`RecipeCard`, `ExternalPostEmbed`) unverändert bleiben.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.external_posts.schemas import ExternalPostPublic
from app.plants.schemas import PlantSpotlight
from app.recipes.schemas import RecipeListItem

FeedItemType = Literal["recipe", "external_post", "spotlight"]


class FeedItem(BaseModel):
    type: FeedItemType
    created_at: datetime
    recipe: RecipeListItem | None = None
    post: ExternalPostPublic | None = None
    spotlight: PlantSpotlight | None = None


class FeedPage(BaseModel):
    items: list[FeedItem]
    # Opaker Cursor für die nächste Seite; `null` heißt: Ende erreicht.
    next_cursor: str | None = None

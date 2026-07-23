"""Schemas der Profil-Pins (Ü18)."""
from pydantic import BaseModel

from app.external_posts.schemas import ExternalPostPublic
from app.recipes.schemas import RecipeListItem

MAX_PRO_TYP = 3


class PinsUpdate(BaseModel):
    """Die Auswahl **ersetzt** die bestehenden Pins je Typ. Reihenfolge in der
    Liste = Anzeigereihenfolge. Je Liste höchstens `MAX_PRO_TYP` (Endpoint)."""

    recipe_ids: list[int] = []
    external_post_ids: list[int] = []


class PinnedContent(BaseModel):
    """Aufgelöste Highlights fürs Profil — öffentlich, kein Gate."""

    recipes: list[RecipeListItem] = []
    posts: list[ExternalPostPublic] = []

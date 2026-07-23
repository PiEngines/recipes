from app.models.access import DisposableEmailDomain, RecipeAccess
from app.models.associations import (
    recipe_allergens,
    recipe_categories,
    recipe_diet_labels,
    recipe_tags,
    user_allergens,
    user_diet_labels,
    user_exclusions,
)
from app.models.category import Allergen, Category, DietLabel, Exclusion, Tag
from app.models.collection import (
    Collection,
    CollectionItem,
    CollectionItemType,
    CollectionRecipe,
    CollectionVisibility,
)
from app.models.cooked_log import CookedLog
from app.models.recipe import (
    Ingredient,
    Recipe,
    RecipeComponent,
    RecipeServeWith,
    RecipeStatus,
    RecipeStep,
    RecipeVersion,
    RecipeVideo,
)
from app.models.external_post import ExternalPlatform, ExternalPost
from app.models.media import Media
from app.models.phaenophase import Phaenophase
from app.models.rating import Rating
from app.models.plant import (
    AnbauTyp,
    Essbarkeit,
    Lebensdauer,
    Plant,
    PlantCalendar,
    PlantRelation,
    PlantTag,
    Schwierigkeitsgrad,
)
from app.models.plant_spotlight import PlantSpotlightHistory
from app.models.shopping import ShoppingListItem
from app.models.step_suggestion import StepUnmatchedSuggestion
from app.models.tokens import EmailVerificationToken, InvitationToken, PasswordResetToken
from app.models.user import User, UserRole
from app.models.user_favorite import UserFavorite
from app.models.user_follow import UserFollow
from app.models.user_pin import PinItemType, UserPin
from app.models.user_plant import UserPlant
from app.models.user_plant_task import UserPlantTaskDone

__all__ = [
    "User",
    "UserRole",
    "Recipe",
    "RecipeStatus",
    "RecipeStep",
    "Ingredient",
    "RecipeVideo",
    "RecipeComponent",
    "RecipeServeWith",
    "RecipeVersion",
    "Category",
    "Tag",
    "DietLabel",
    "Allergen",
    "Exclusion",
    "Collection",
    "CollectionRecipe",
    "CollectionItem",
    "CollectionItemType",
    "CollectionVisibility",
    "CookedLog",
    "recipe_categories",
    "recipe_tags",
    "recipe_diet_labels",
    "recipe_allergens",
    "user_diet_labels",
    "user_allergens",
    "user_exclusions",
    "Media",
    "ExternalPost",
    "ExternalPlatform",
    "InvitationToken",
    "PasswordResetToken",
    "EmailVerificationToken",
    "RecipeAccess",
    "DisposableEmailDomain",
    "UserFavorite",
    "UserFollow",
    "UserPin",
    "PinItemType",
    "UserPlant",
    "UserPlantTaskDone",
    "ShoppingListItem",
    "StepUnmatchedSuggestion",
    "Rating",
    "Plant",
    "PlantTag",
    "PlantRelation",
    "PlantCalendar",
    "PlantSpotlightHistory",
    "Lebensdauer",
    "AnbauTyp",
    "Schwierigkeitsgrad",
    "Essbarkeit",
    "Phaenophase",
]

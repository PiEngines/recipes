from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.recipe import RecipeStatus, RecipeType
from app.utils.units import normalize_label


class CategoryResponse(BaseModel):
    id: int
    name: str
    slug: str
    model_config = {"from_attributes": True}


class TagResponse(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


class DietLabelResponse(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


class AllergenResponse(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


class AuthorResponse(BaseModel):
    id: int
    name: str
    username: str | None = None
    model_config = {"from_attributes": True}


# ── Ingredients ───────────────────────────────────────────────────────────────

class IngredientCreate(BaseModel):
    component_label: str | None = None
    name: str
    amount: str | None = None
    unit: str | None = None
    sort_order: int = 0
    is_integer: bool = False

    @field_validator('name')
    @classmethod
    def trim_name(cls, v: str) -> str:
        return v.strip()

    # Am Schema statt in den Routen: Anlegen und Aktualisieren gehen beide
    # hierdurch, damit steht die Einheit gar nicht erst uneinheitlich in der DB
    # (BUG-34). Unbekanntes bleibt erhalten.
    @field_validator('unit')
    @classmethod
    def einheit_vereinheitlichen(cls, v: str | None) -> str | None:
        return normalize_label(v)


class IngredientResponse(BaseModel):
    id: int
    component_label: str | None
    name: str
    amount: str | None
    unit: str | None
    sort_order: int
    is_integer: bool
    model_config = {"from_attributes": True}


# ── Steps ─────────────────────────────────────────────────────────────────────

class RecipeStepCreate(BaseModel):
    id: int | None = None
    sort_order: int
    title: str | None = None
    instruction: str
    timer_seconds: int | None = None
    timer_label: str | None = None
    image_path: str | None = None
    video_path: str | None = None
    ingredient_ids: list[int] | None = None


class RecipeStepResponse(BaseModel):
    id: int
    sort_order: int
    title: str | None
    instruction: str
    timer_seconds: int | None
    timer_label: str | None
    image_path: str | None
    video_path: str | None
    ingredient_ids: list[int] | None
    is_module_step: bool = False
    model_config = {"from_attributes": True}


# ── Step-ingredient response (for the step-ingredients endpoint) ──────────────

class StepIngredientResponse(BaseModel):
    id: int
    name: str
    amount: str | None
    unit: str | None
    component_label: str | None
    auto_detected: bool


class StepIngredientsResponse(BaseModel):
    ingredients: list[StepIngredientResponse]
    suspicious_tokens: list[str]


class RematchResponse(BaseModel):
    steps_updated: int


class StepIngredientIdsUpdate(BaseModel):
    ingredient_ids: list[int]


# ── Step suggestions (unmatched-token review) ─────────────────────────────────

class StepSuggestionItem(BaseModel):
    id: int
    step_id: int
    token: str
    bls_id: str
    bls_name: str
    confidence: str
    model_config = {"from_attributes": True}


class StepSuggestionGroup(BaseModel):
    step_id: int
    suggestions: list[StepSuggestionItem]


class StepSuggestionAccept(BaseModel):
    name: str
    quantity: str | None = None
    unit: str | None = None
    step_ids: list[int]

    @field_validator('name')
    @classmethod
    def trim_name(cls, v: str) -> str:
        return v.strip()

    # Der Einzel-Add legt eine `Ingredient`-Zeile an und geht nicht über
    # `IngredientCreate` — die Normalisierung gehört deshalb auch hierhin.
    @field_validator('unit')
    @classmethod
    def einheit_vereinheitlichen(cls, v: str | None) -> str | None:
        return normalize_label(v)


# ── Recipe ────────────────────────────────────────────────────────────────────

class ComponentEmbedInfo(BaseModel):
    id: int
    child_recipe_id: int
    child_recipe_title: str
    sort_order: int
    servings_override: int | None
    scale_factor: float | None


class RecipeCreate(BaseModel):
    title: str
    description: str | None = None
    prep_time: int | None = None
    cook_time: int | None = None
    servings: int | None = None
    difficulty: int | None = Field(None, ge=1, le=5)
    status: RecipeStatus = RecipeStatus.published
    type: RecipeType = RecipeType.kochen
    course: str | None = None
    source: str | None = None
    category_ids: list[int] = []
    tag_ids: list[int] = []
    ingredients: list[IngredientCreate] = []
    steps: list[RecipeStepCreate] = []


class RecipeUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    prep_time: int | None = None
    cook_time: int | None = None
    servings: int | None = None
    difficulty: int | None = Field(None, ge=1, le=5)
    status: RecipeStatus | None = None
    type: RecipeType | None = None
    course: str | None = None
    source: str | None = None
    category_ids: list[int] | None = None
    tag_ids: list[int] | None = None
    ingredients: list[IngredientCreate] | None = None
    steps: list[RecipeStepCreate] | None = None


class RecipeListItem(BaseModel):
    """Compact representation used in paginated list responses."""

    id: int
    title: str
    description: str | None
    prep_time: int | None
    cook_time: int | None
    servings: int | None
    difficulty: int | None
    status: str
    type: str = "kochen"
    review_status: str | None = None
    thumbnail_style: str = "crop"
    primary_image: str | None = None
    rating_avg: float | None = None
    rating_count: int = 0
    created_by: int | None = None
    created_at: datetime
    updated_at: datetime | None = None
    deleted_at: datetime | None = None
    author: AuthorResponse | None = None
    categories: list[CategoryResponse]
    tags: list[TagResponse]
    model_config = {"from_attributes": True}


class RecipeResponse(BaseModel):
    """Full recipe with all relations."""

    id: int
    title: str
    description: str | None
    prep_time: int | None
    cook_time: int | None
    servings: int | None
    difficulty: int | None
    status: str
    type: str = "kochen"
    course: str | None = None
    source: str | None
    review_status: str | None = None
    thumbnail_style: str = "crop"
    created_by: int | None = None
    created_at: datetime
    updated_at: datetime
    author: AuthorResponse
    steps: list[RecipeStepResponse]
    ingredients: list[IngredientResponse]
    categories: list[CategoryResponse]
    tags: list[TagResponse]
    diet_labels: list[DietLabelResponse]
    allergens: list[AllergenResponse]
    is_pending_review: bool = False
    rating_avg: float | None = None
    rating_count: int = 0
    module_authors: list[AuthorResponse] | None = None
    components: list[ComponentEmbedInfo] = []
    model_config = {"from_attributes": True}


# ── Modules ───────────────────────────────────────────────────────────────────

class ComponentCreate(BaseModel):
    child_recipe_id: int
    sort_order: int = 0
    servings_override: Optional[int] = None
    scale_factor: Optional[float] = Field(None, ge=0.1, le=10.0)


class ComponentResponse(BaseModel):
    parent_recipe_id: int
    child_recipe_id: int
    sort_order: int
    flatten_into_parent: bool
    servings_override: int | None
    scale_factor: float | None
    referenced_version_id: int | None
    model_config = {"from_attributes": True}


class UsedInResponse(BaseModel):
    count: int


class ExtractComponentBody(BaseModel):
    component_label: str
    new_recipe_title: str


class ExtractComponentResponse(BaseModel):
    new_recipe_id: int
    new_recipe_title: str
    component_id: int


class PaginatedRecipes(BaseModel):
    items: list[RecipeListItem]
    total: int
    page: int
    page_size: int
    pages: int
    # Faceted counts: je Facette wird der eigene Filter weggelassen, alle
    # anderen aktiven Facetten angewandt. Keys sind JSON-Strings (id/value/level).
    facets: dict[str, dict[str, int]] = {}


# ── Serve With ────────────────────────────────────────────────────────────────

class ServeWithItem(BaseModel):
    id: int
    title: str


class ServeWithUpdate(BaseModel):
    recipe_ids: list[int]

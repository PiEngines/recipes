from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.recipe import RecipeStatus


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
    model_config = {"from_attributes": True}


class RecipeImageResponse(BaseModel):
    id: int
    file_path: str
    is_primary: bool
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
    model_config = {"from_attributes": True}


# ── Step-ingredient response (for the step-ingredients endpoint) ──────────────

class StepIngredientResponse(BaseModel):
    id: int
    name: str
    amount: str | None
    unit: str | None
    component_label: str | None
    auto_detected: bool


# ── Recipe ────────────────────────────────────────────────────────────────────

class RecipeCreate(BaseModel):
    title: str
    description: str | None = None
    prep_time: int | None = None
    cook_time: int | None = None
    servings: int | None = None
    difficulty: int | None = Field(None, ge=1, le=10)
    status: RecipeStatus = RecipeStatus.draft
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
    difficulty: int | None = Field(None, ge=1, le=10)
    status: RecipeStatus | None = None
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
    created_at: datetime
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
    source: str | None
    created_at: datetime
    updated_at: datetime
    author: AuthorResponse
    steps: list[RecipeStepResponse]
    ingredients: list[IngredientResponse]
    categories: list[CategoryResponse]
    tags: list[TagResponse]
    diet_labels: list[DietLabelResponse]
    allergens: list[AllergenResponse]
    images: list[RecipeImageResponse]
    model_config = {"from_attributes": True}


class PaginatedRecipes(BaseModel):
    items: list[RecipeListItem]
    total: int
    page: int
    page_size: int
    pages: int

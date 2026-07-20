from pydantic import BaseModel, Field


class ShoppingItem(BaseModel):
    id: int
    recipe_id: int | None = None
    recipe_title: str | None = None
    name: str
    amount: str | None = None
    unit: str | None = None
    checked: bool
    sort_order: int
    model_config = {"from_attributes": True}


class ShoppingSumItem(ShoppingItem):
    """Zeile der summierten Ansicht.

    Fasst mehrere Quell-Positionen zusammen, wenn Name (normalisiert) und
    Einheit übereinstimmen und alle Beträge parsebar sind. `id` ist dabei die
    des ersten Quell-Items; `source_ids` trägt alle — nötig fürs Abhaken.
    """

    merged_from_count: int = 1
    recipe_titles: list[str] = []
    source_ids: list[int] = []


class ShoppingGroup(BaseModel):
    recipe_id: int | None = None
    recipe_title: str
    position_count: int
    items: list[ShoppingItem] = []


class ShoppingProgress(BaseModel):
    total: int
    done: int
    percent: int


class ShoppingListResponse(BaseModel):
    group: str
    progress: ShoppingProgress
    # group=recipe → nach Rezept gebündelt; group=sum → leer
    groups: list[ShoppingGroup] = []
    # group=sum → flache, summierte Liste; group=recipe → leer
    items: list[ShoppingSumItem] = []


class ManualItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    amount: str | None = Field(default=None, max_length=100)
    unit: str | None = Field(default=None, max_length=100)


class FromRecipeRequest(BaseModel):
    recipe_id: int
    servings: int = Field(gt=0)
    ingredient_ids: list[int] = Field(min_length=1)


class FromRecipeResponse(BaseModel):
    added: int


class ItemPatch(BaseModel):
    checked: bool | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    amount: str | None = Field(default=None, max_length=100)
    unit: str | None = Field(default=None, max_length=100)


class ClearDoneResponse(BaseModel):
    removed: int

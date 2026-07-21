from datetime import datetime

from pydantic import BaseModel, Field

from app.models.external_post import ExternalPlatform


class ExternalPostCreate(BaseModel):
    platform: ExternalPlatform
    url: str = Field(min_length=1, max_length=1000)


class ExternalPostItem(BaseModel):
    """Kompakte Form — auch von den Sammlungen verwendet."""

    id: int
    platform: str
    url: str
    thumbnail_url: str | None = None
    author_name: str | None = None
    model_config = {"from_attributes": True}


class ExternalPostPublic(ExternalPostItem):
    """Fremdsicht fürs öffentliche Profil (F3b-2a).

    `ExternalPostItem` + `oembed_html` — ohne dieses Feld bliebe ein
    TikTok-Beitrag auf fremden Profilen stumm (der Player entsteht erst aus dem
    oEmbed-Markup; Instagram baut seinen iFrame dagegen aus der URL).
    Bewusst NICHT dabei: `caption_text`, `extracted_ingredients`, `recipe_id`,
    `created_by` — das ist die private Arbeitsfläche des Autors.

    Eigener Typ statt einer Erweiterung von `ExternalPostItem`: dessen Form
    nutzen die Sammlungen und die eigene Liste und bleibt unverändert.
    """

    oembed_html: str | None = None


class ExternalPostDetail(ExternalPostItem):
    created_by: int
    oembed_html: str | None = None
    caption_text: str | None = None
    extracted_ingredients: list | dict | None = None
    created_at: datetime
    recipe_id: int | None = None
    # Kein Spaltenwert, sondern per Join nachgereicht — trägt den „Rezept
    # ansehen"-Button, ohne dass das Frontend das Rezept nachladen muss.
    recipe_title: str | None = None


class ExternalPostPreviewRequest(BaseModel):
    """Vorschau vor dem Speichern — gleiche Felder wie `ExternalPostCreate`,
    aber bewusst ein eigener Typ: die beiden duerfen sich unabhaengig
    entwickeln."""

    platform: ExternalPlatform
    url: str = Field(min_length=1, max_length=1000)


class ExtractedIngredient(BaseModel):
    """Eine Position der extrahierten Zutatenliste.

    `raw` ist die bereinigte Caption-Zeile, aus der die Position entstand — sie
    bleibt erhalten, damit im Frontend nachvollziehbar ist, was die Heuristik
    gelesen hat.
    """

    name: str = Field(min_length=1, max_length=255)
    amount: str | None = Field(default=None, max_length=100)
    unit: str | None = Field(default=None, max_length=100)
    raw: str | None = Field(default=None, max_length=500)


class ExternalPostPatch(BaseModel):
    """Teil-Update. Ausgewertet wird über `model_fields_set`, damit „Feld nicht
    mitgeschickt" und „Feld ausdrücklich auf null gesetzt" unterscheidbar
    bleiben."""

    caption_text: str | None = None
    extracted_ingredients: list[ExtractedIngredient] | None = None
    # `null` löst die Verknüpfung — deshalb die Unterscheidung über
    # `model_fields_set`.
    recipe_id: int | None = None


class ToShoppingListResponse(BaseModel):
    created: int


class ExternalPostPreview(BaseModel):
    """Live-Vorschau. Kein `id`/`created_at` — es wird nichts angelegt."""

    platform: str
    url: str
    oembed_html: str | None = None
    thumbnail_url: str | None = None
    author_name: str | None = None
    caption_text: str | None = None

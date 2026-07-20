"""Bring!-Integration per Rezept-Deeplink (F2b/S2).

  POST /api/recipes/{recipe_id}/bring-link  – signierten Klon-Link erzeugen
  GET  /api/share/recipe/{token}            – öffentlicher, zustandsloser Klon

Ablauf: Das Frontend lässt sich einen Link minten und schickt den User auf den
Bring!-Deeplink. Bring! crawlt daraufhin die Klon-URL und liest das
schema.org/Recipe-JSON-LD.

Beide Routen liegen bewusst unter /api/ — Caddy leitet nur /api/* ans Backend,
alles andere geht an die SPA.

Der Klon ist zustandslos: das HTML wird pro Request frisch aus der DB gerendert,
nichts wird gespeichert oder zwischengehalten.
"""
import html
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.bring.tokens import create_share_token, read_share_token
from app.config import settings
from app.database import get_db
from app.models import Ingredient, Recipe, User
from app.models.access import RecipeAccess
from app.models.media import Media
from app.models.recipe import RecipeStatus
from app.models.user import UserRole
from app.recipes.router import _get_or_404
from app.storage import storage

router = APIRouter(prefix="/api", tags=["bring"])


def _is_editor(recipe: Recipe, user: User) -> bool:
    """Autor oder Redaktionsrolle — gleiche Bedingung wie
    `recipes.router._require_author_or_chef`, nur ohne zu werfen."""
    ist_autor = recipe.author_id == user.id or recipe.created_by == user.id
    return ist_autor or user.role in (UserRole.kuechenchef, UserRole.chefkoch, UserRole.admin)


def _is_free_for_all(recipe_id: int, db: Session) -> bool:
    """Rezept ist öffentlich freigegeben.

    Gleiches Prädikat wie die unauthentifizierte Sichtbarkeit in
    `recipes.router._apply_visibility_filter`: aktiver `free_for_all`-Eintrag,
    nicht abgelehnt, nicht abgelaufen.
    """
    now = datetime.now(timezone.utc)
    return db.query(
        db.query(RecipeAccess)
        .filter(
            RecipeAccess.recipe_id == recipe_id,
            RecipeAccess.access_type == "free_for_all",
            RecipeAccess.declined_at.is_(None),
            or_(RecipeAccess.expires_at.is_(None), RecipeAccess.expires_at > now),
        )
        .exists()
    ).scalar()


@router.post("/recipes/{recipe_id}/bring-link")
def create_bring_link(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Signierten Klon-Link erzeugen.

    Erlaubt für Autor/Redaktion — und für jeden eingeloggten User, wenn das
    Rezept öffentlich (`free_for_all`) ist: ein entdecktes Rezept in die eigene
    Bring!-Liste zu übernehmen ist der Kern-Use-Case.

    Bewusst NICHT „darf sehen" pauschal: wer ein nicht-öffentliches Rezept nur
    individuell freigegeben bekommen hat, soll es nicht öffentlich
    weiter-teilbar machen können (kein Re-Share).
    """
    recipe = _get_or_404(recipe_id, db)
    if not _is_editor(recipe, current_user) and not _is_free_for_all(recipe.id, db):
        raise HTTPException(status_code=403, detail="Zugriff verweigert")

    token = create_share_token(recipe.id)
    return {"url": f"{settings.app_url}/api/share/recipe/{token}"}


def _ingredient_lines(db: Session, recipe_id: int) -> list[str]:
    rows = (
        db.query(Ingredient)
        .filter(Ingredient.recipe_id == recipe_id)
        .order_by(Ingredient.sort_order, Ingredient.id)
        .all()
    )
    lines = []
    for ing in rows:
        teile = [p for p in (ing.amount, ing.unit, ing.name) if p]
        if teile:
            lines.append(" ".join(teile))
    return lines


def _primary_image_url(db: Session, recipe_id: int) -> str | None:
    """Absolute URL des Titelbilds — Bring! lädt das Bild von außen."""
    media = (
        db.query(Media)
        .filter(
            Media.entity_type == "recipe",
            Media.entity_id == recipe_id,
            Media.media_type == "image",
            Media.processing_status == "ready",
            Media.deleted_at.is_(None),
        )
        .order_by(Media.is_primary.desc(), Media.sort_order, Media.id)
        .first()
    )
    if media is None or not media.storage_path:
        return None
    # Gleiche Ableitung wie in media/schemas.py — dort relativ ("/media/…"),
    # hier absolut, weil der Crawler keinen Seitenkontext hat.
    pfad = storage.get_url(media.storage_path)
    if pfad.startswith("http://") or pfad.startswith("https://"):
        return pfad
    return f"{settings.app_url}{pfad}"


@router.get("/share/recipe/{token}", response_class=HTMLResponse)
def share_recipe_clone(
    token: str,
    db: Session = Depends(get_db),
):
    """Öffentlicher Klon für den Bring!-Crawler — kein Auth, der Token autorisiert."""
    recipe_id = read_share_token(token)
    if recipe_id is None:
        raise HTTPException(status_code=410, detail="Dieser Link ist abgelaufen oder ungültig")

    recipe = (
        db.query(Recipe)
        .filter(
            Recipe.id == recipe_id,
            Recipe.deleted_at.is_(None),
            Recipe.status == RecipeStatus.published,
        )
        .first()
    )
    if recipe is None:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")

    autor = db.query(User).filter(User.id == recipe.created_by).first()
    autor_name = (autor.username or autor.name) if autor else "PiEngines"
    zutaten = _ingredient_lines(db, recipe.id)
    bild = _primary_image_url(db, recipe.id)

    # schema.org/Recipe — Pflichtfelder für Bring!: Titel, Autor, Zutaten.
    # Bewusst ohne recipeInstructions: Bring! braucht nur die Zutaten.
    ld = {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": recipe.title,
        "author": {"@type": "Person", "name": autor_name},
        "recipeIngredient": zutaten,
    }
    if bild:
        ld["image"] = bild
    if recipe.servings:
        ld["recipeYield"] = str(recipe.servings)

    # json.dumps escapt kein "<" — für einen <script>-Block schließen wir
    # ein vorzeitiges </script> zusätzlich aus.
    ld_json = json.dumps(ld, ensure_ascii=False).replace("<", "\\u003c")

    titel = html.escape(recipe.title)
    autor_escaped = html.escape(autor_name)
    zutaten_html = "\n".join(f"      <li>{html.escape(z)}</li>" for z in zutaten)

    body = f"""<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="robots" content="noindex">
    <title>{titel}</title>
    <script type="application/ld+json">{ld_json}</script>
  </head>
  <body>
    <h1>{titel}</h1>
    <p>von {autor_escaped}</p>
    <ul>
{zutaten_html}
    </ul>
  </body>
</html>"""

    return HTMLResponse(content=body, headers={"X-Robots-Tag": "noindex"})

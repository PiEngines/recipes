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

Er trägt bewusst nur das Nötigste: Rezepttitel, Zutaten und — als Autor —
konstant die Plattform. Kein Titelbild (Bildrechte bleiben beim User) und kein
Klarname/Username, weil die Seite ohne Login abrufbar ist.
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
from app.models.recipe import RecipeStatus
from app.models.user import UserRole
from app.recipes.router import _get_or_404

router = APIRouter(prefix="/api", tags=["bring"])

# Der Klon ist ohne Login abrufbar. Als Autor steht dort deshalb konstant die
# Plattform statt einer Person — Bring! braucht das Feld, aber keinen Namen.
CLONE_AUTHOR = "PiEngines"


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

    zutaten = _ingredient_lines(db, recipe.id)

    # schema.org/Recipe — Pflichtfelder für Bring!: Titel, Autor, Zutaten.
    # Bewusst NICHT enthalten:
    #   image                — Bildrechte bleiben beim User; für den Import nur
    #                          empfohlen, nicht erforderlich.
    #   Klarname/Username    — der Klon ist öffentlich abrufbar, deshalb steht
    #                          dort konstant CLONE_AUTHOR statt einer Person.
    #   recipeInstructions   — Bring! braucht nur die Zutaten.
    ld = {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": recipe.title,
        "author": {"@type": "Person", "name": CLONE_AUTHOR},
        "recipeIngredient": zutaten,
    }
    if recipe.servings:
        ld["recipeYield"] = str(recipe.servings)

    # json.dumps escapt kein "<" — für einen <script>-Block schließen wir
    # ein vorzeitiges </script> zusätzlich aus.
    ld_json = json.dumps(ld, ensure_ascii=False).replace("<", "\\u003c")

    titel = html.escape(recipe.title)
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
    <p>von {CLONE_AUTHOR}</p>
    <ul>
{zutaten_html}
    </ul>
  </body>
</html>"""

    return HTMLResponse(content=body, headers={"X-Robots-Tag": "noindex"})

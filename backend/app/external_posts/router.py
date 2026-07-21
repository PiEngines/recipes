"""External Posts (F3a/Commit 3) — Persistenz-Layer für Instagram/TikTok-Links.

  POST   /api/external-posts            – Link speichern
  GET    /api/external-posts?mine=true  – eigene Posts
  GET    /api/external-posts/{id}
  DELETE /api/external-posts/{id}       – nur Owner

F3b-1 ergänzt oEmbed-Abruf und Zutaten-Extraktion:

  POST   /api/external-posts/preview            – Vorschau, legt NICHTS an
  POST   /api/external-posts/{id}/refresh       – oEmbed erneut abrufen (Owner)
  PATCH  /api/external-posts/{id}               – Caption/Zutaten/Rezept (Owner)
  POST   /api/external-posts/{id}/to-shopping-list – Zutaten übernehmen (Owner)

Beim Anlegen werden `oembed_html`, `thumbnail_url`, `author_name` und (nur bei
TikTok) `caption_text` server-seitig nachgeladen; aus der Caption entstehen die
`extracted_ingredients`.
"""
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_koch_or_above
from app.database import get_db
from app.external_posts.extract import extract_ingredients
from app.external_posts.oembed import OEmbedError, fetch_oembed
from app.external_posts.schemas import (
    ExternalPostCreate,
    ExternalPostDetail,
    ExternalPostItem,
    ExternalPostPatch,
    ExternalPostPreview,
    ExternalPostPreviewRequest,
    ExternalPostPublic,
    ToShoppingListResponse,
)
from app.models import ExternalPlatform, ExternalPost, Recipe, ShoppingListItem, User
from app.models.recipe import RecipeStatus
from app.shopping.router import _next_sort_order

router = APIRouter(prefix="/api/external-posts", tags=["external-posts"])

# Fremdsicht fürs öffentliche Profil (F3b-2a). Eigener Router, weil der Pfad
# unter /api/users hängt — inhaltlich gehört er aber hierher.
users_router = APIRouter(prefix="/api/users", tags=["external-posts"])

# Erlaubte Hosts je Plattform (jeweils auch als www./m.-Variante).
_HOSTS: dict[ExternalPlatform, tuple[str, ...]] = {
    ExternalPlatform.instagram: ("instagram.com", "instagr.am"),
    ExternalPlatform.tiktok: ("tiktok.com",),
}

# Anzeigename der Plattform (für das Einkaufslisten-Label).
_PLATTFORM_LABEL = {"instagram": "Instagram", "tiktok": "TikTok"}


def _host_passt(url: str, platform: ExternalPlatform) -> bool:
    """Host der URL muss zur angegebenen Plattform gehören.

    Vergleich auf Domain-Ebene statt per `in`: „instagram.com.angreifer.tld"
    oder „nichtinstagram.com" dürfen nicht durchrutschen.
    """
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False

    host = parsed.hostname.lower().rstrip(".")
    return any(
        host == erlaubt or host.endswith("." + erlaubt)
        for erlaubt in _HOSTS[platform]
    )


def _feld(wert: object, limit: int) -> str | None:
    """JSONB-Inhalt ist ungeprüft — auf Spaltenbreite bringen, Rest verwerfen."""
    if wert is None:
        return None
    text = str(wert).strip()[:limit]
    return text or None


def _herkunft_label(post: ExternalPost) -> str:
    """Gruppen-Label der Einkaufsliste, z. B. „koch · TikTok"."""
    plattform = _PLATTFORM_LABEL.get(post.platform, post.platform)
    label = f"{post.author_name} · {plattform}" if post.author_name else plattform
    return label[:255]


def _enrich(post: ExternalPost) -> bool:
    """oEmbed nachladen und die Cache-Felder setzen.

    Gibt `False` zurück, wenn der Abruf fehlschlug. Der Fehler wird bewusst
    geschluckt: ein toter oEmbed-Endpunkt darf das Speichern eines Links nicht
    verhindern. Die Felder bleiben dann leer und lassen sich per `/refresh`
    nachziehen.
    """
    try:
        ergebnis = fetch_oembed(post.platform, post.url)
    except OEmbedError:
        return False

    post.oembed_html = ergebnis.html
    post.thumbnail_url = ergebnis.thumbnail_url
    post.author_name = ergebnis.author_name
    # Caption nur anfassen, wenn die Plattform wirklich etwas Neues liefert:
    # bei Instagram ist `caption_text` immer None und würde eine manuell
    # eingefügte Beschreibung beim Refresh sonst löschen. Und bei unveränderter
    # Caption bleibt eine von Hand korrigierte Zutatenliste erhalten.
    if ergebnis.caption_text and ergebnis.caption_text != post.caption_text:
        post.caption_text = ergebnis.caption_text
        post.extracted_ingredients = extract_ingredients(ergebnis.caption_text)
    return True


def _detail(db: Session, post: ExternalPost) -> ExternalPostDetail:
    """Detail-Antwort inkl. `recipe_title` — ein Join statt eines Nachladens
    im Frontend."""
    detail = ExternalPostDetail.model_validate(post)
    if post.recipe_id is None:
        return detail

    titel = db.query(Recipe.title).filter(Recipe.id == post.recipe_id).scalar()
    return detail.model_copy(update={"recipe_title": titel})


def _geprueftes_rezept(db: Session, recipe_id: int | None) -> int | None:
    """Verknüpfbar ist nur ein existierendes, veröffentlichtes Rezept.

    Ein Entwurf oder ein gelöschtes Rezept würde im Frontend zu einem
    „Rezept ansehen"-Button führen, der ins Leere zeigt.
    """
    if recipe_id is None:
        return None

    rezept = (
        db.query(Recipe.id)
        .filter(
            Recipe.id == recipe_id,
            Recipe.deleted_at.is_(None),
            Recipe.status == RecipeStatus.published,
        )
        .first()
    )
    if rezept is None:
        raise HTTPException(status_code=400, detail="Rezept nicht gefunden")
    return recipe_id


def _own_post_or_404(db: Session, post_id: int, user: User) -> ExternalPost:
    post = db.query(ExternalPost).filter(ExternalPost.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=404, detail="Beitrag nicht gefunden")
    if post.created_by != user.id:
        raise HTTPException(status_code=403, detail="Zugriff verweigert")
    return post


@router.post("", response_model=ExternalPostDetail, status_code=status.HTTP_201_CREATED)
def create_external_post(
    body: ExternalPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    if not _host_passt(body.url, body.platform):
        raise HTTPException(
            status_code=400,
            detail=f"Die URL gehört nicht zu {body.platform.value}",
        )

    post = ExternalPost(
        created_by=current_user.id,
        platform=body.platform.value,
        url=body.url.strip(),
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    # Erst speichern, dann anreichern — in dieser Reihenfolge überlebt der Link
    # auch einen oEmbed-Ausfall.
    if _enrich(post):
        db.commit()
        db.refresh(post)

    return _detail(db, post)


@router.post("/preview", response_model=ExternalPostPreview)
def preview_external_post(
    body: ExternalPostPreviewRequest,
    current_user: User = Depends(require_koch_or_above),
):
    """Live-Vorschau vor dem Speichern — legt bewusst nichts an.

    Anders als beim Anlegen ist ein oEmbed-Fehler hier hart (502): eine
    Vorschau ohne Inhalt hätte keinen Wert.
    """
    if not _host_passt(body.url, body.platform):
        raise HTTPException(
            status_code=400,
            detail=f"Die URL gehört nicht zu {body.platform.value}",
        )

    url = body.url.strip()
    try:
        ergebnis = fetch_oembed(body.platform, url)
    except OEmbedError:
        raise HTTPException(status_code=502, detail="Vorschau fehlgeschlagen")

    return ExternalPostPreview(
        platform=body.platform.value,
        url=url,
        oembed_html=ergebnis.html,
        thumbnail_url=ergebnis.thumbnail_url,
        author_name=ergebnis.author_name,
        caption_text=ergebnis.caption_text,
    )


@router.post("/{post_id}/refresh", response_model=ExternalPostDetail)
def refresh_external_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    """oEmbed erneut abrufen — für Beiträge, deren Anreicherung fehlschlug."""
    post = _own_post_or_404(db, post_id, current_user)
    if not _enrich(post):
        raise HTTPException(status_code=502, detail="Vorschau fehlgeschlagen")

    db.commit()
    db.refresh(post)
    return _detail(db, post)


@router.get("", response_model=list[ExternalPostItem])
def list_external_posts(
    mine: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    """Aktuell ausschließlich die eigenen Beiträge — eine Fremdsicht käme erst
    mit dem Feed (F3b) und bräuchte eine eigene Sichtbarkeitsregel."""
    query = db.query(ExternalPost).filter(ExternalPost.created_by == current_user.id)
    return [
        ExternalPostItem.model_validate(p)
        for p in query.order_by(ExternalPost.created_at.desc(), ExternalPost.id.desc()).all()
    ]


@users_router.get("/{user_id}/external-posts", response_model=list[ExternalPostPublic])
def list_external_posts_by_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    """Verlinkte Beiträge eines Users — die Fremdsicht fürs öffentliche Profil.

    Ohne Sichtbarkeitsregel: einen Beitrag zu verlinken ist bereits die
    Entscheidung, ihn zu zeigen. Die Antwort bleibt trotzdem knapp
    (`ExternalPostPublic`) — Caption, Zutaten und Rezept-Verknüpfung sind die
    private Arbeitsfläche des Autors und gehen Fremde nichts an.
    """
    nutzer = (
        db.query(User.id)
        .filter(User.id == user_id, User.deleted_at.is_(None))
        .first()
    )
    if nutzer is None:
        raise HTTPException(status_code=404, detail="Nutzer nicht gefunden")

    posts = (
        db.query(ExternalPost)
        .filter(ExternalPost.created_by == user_id)
        .order_by(ExternalPost.created_at.desc(), ExternalPost.id.desc())
        .all()
    )
    return [ExternalPostPublic.model_validate(p) for p in posts]


@router.get("/{post_id}", response_model=ExternalPostDetail)
def get_external_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    post = db.query(ExternalPost).filter(ExternalPost.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=404, detail="Beitrag nicht gefunden")
    return _detail(db, post)


@router.patch("/{post_id}", response_model=ExternalPostDetail)
def patch_external_post(
    post_id: int,
    body: ExternalPostPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    """Caption nachtragen, Zutatenliste korrigieren oder Rezept verknüpfen.

    Der Hauptfall ist Instagram: von dort kommt per oEmbed keine Caption, der
    User fügt sie also selbst ein — daraufhin wird neu geparst. Schickt er
    stattdessen (oder zusätzlich) eine `extracted_ingredients`-Liste, gewinnt
    diese: eine Handkorrektur darf nicht vom Parser überschrieben werden.
    """
    post = _own_post_or_404(db, post_id, current_user)
    gesetzt = body.model_fields_set

    # Zuerst prüfen, dann schreiben: ein abgelehntes `recipe_id` darf keine
    # halb angewandte Caption-Änderung in der Session zurücklassen.
    if "recipe_id" in gesetzt:
        post.recipe_id = _geprueftes_rezept(db, body.recipe_id)

    if "caption_text" in gesetzt:
        post.caption_text = body.caption_text or None
        post.extracted_ingredients = extract_ingredients(post.caption_text)

    if "extracted_ingredients" in gesetzt:
        post.extracted_ingredients = (
            [zutat.model_dump() for zutat in body.extracted_ingredients]
            if body.extracted_ingredients is not None
            else None
        )

    db.commit()
    db.refresh(post)
    return _detail(db, post)


@router.post(
    "/{post_id}/to-shopping-list",
    response_model=ToShoppingListResponse,
    status_code=status.HTTP_201_CREATED,
)
def to_shopping_list(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    """Die extrahierten Zutaten auf die Einkaufsliste legen.

    Angelegt werden gewöhnliche manuelle Positionen (`recipe_id` NULL) — die
    Einkaufsliste kennt keine externen Beiträge und soll sie auch nicht kennen.
    `recipe_title` trägt die Herkunft, damit die Gruppierung sie zeigen kann.
    """
    post = _own_post_or_404(db, post_id, current_user)

    zutaten = post.extracted_ingredients
    if not isinstance(zutaten, list):
        zutaten = []

    label = _herkunft_label(post)
    sort_order = _next_sort_order(db, current_user)
    angelegt = 0

    for zutat in zutaten:
        if not isinstance(zutat, dict):
            continue
        name = str(zutat.get("name") or "").strip()
        if not name:
            continue

        db.add(
            ShoppingListItem(
                user_id=current_user.id,
                recipe_id=None,
                recipe_title=label,
                name=name[:255],
                amount=_feld(zutat.get("amount"), 100),
                unit=_feld(zutat.get("unit"), 100),
                checked=False,
                sort_order=sort_order,
            )
        )
        sort_order += 1
        angelegt += 1

    db.commit()
    return ToShoppingListResponse(created=angelegt)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_external_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    post = _own_post_or_404(db, post_id, current_user)
    db.delete(post)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

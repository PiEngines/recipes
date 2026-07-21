"""External Posts (F3a/Commit 3) — Persistenz-Layer für Instagram/TikTok-Links.

  POST   /api/external-posts            – Link speichern
  GET    /api/external-posts?mine=true  – eigene Posts
  GET    /api/external-posts/{id}
  DELETE /api/external-posts/{id}       – nur Owner

F3b-1 ergänzt den oEmbed-Abruf:

  POST   /api/external-posts/preview      – Vorschau, legt NICHTS an
  POST   /api/external-posts/{id}/refresh – oEmbed erneut abrufen (nur Owner)

Beim Anlegen werden `oembed_html`, `thumbnail_url`, `author_name` und (nur bei
TikTok) `caption_text` server-seitig nachgeladen.
"""
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_koch_or_above
from app.database import get_db
from app.external_posts.oembed import OEmbedError, fetch_oembed
from app.external_posts.schemas import (
    ExternalPostCreate,
    ExternalPostDetail,
    ExternalPostItem,
    ExternalPostPreview,
    ExternalPostPreviewRequest,
)
from app.models import ExternalPlatform, ExternalPost, User

router = APIRouter(prefix="/api/external-posts", tags=["external-posts"])

# Erlaubte Hosts je Plattform (jeweils auch als www./m.-Variante).
_HOSTS: dict[ExternalPlatform, tuple[str, ...]] = {
    ExternalPlatform.instagram: ("instagram.com", "instagr.am"),
    ExternalPlatform.tiktok: ("tiktok.com",),
}


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
    # Nur überschreiben, wenn die Plattform wirklich etwas liefert: bei
    # Instagram ist `caption_text` immer None und würde eine bereits manuell
    # eingefügte Beschreibung beim Refresh sonst wieder löschen.
    if ergebnis.caption_text:
        post.caption_text = ergebnis.caption_text
    return True


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

    return ExternalPostDetail.model_validate(post)


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
    return ExternalPostDetail.model_validate(post)


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


@router.get("/{post_id}", response_model=ExternalPostDetail)
def get_external_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_koch_or_above),
):
    post = db.query(ExternalPost).filter(ExternalPost.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=404, detail="Beitrag nicht gefunden")
    return ExternalPostDetail.model_validate(post)


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

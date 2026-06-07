import io
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from PIL import Image
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_optional_user
from app.config import settings
from app.database import SessionLocal, get_db
from app.media.schemas import MediaOut, MediaStatusOut
from app.media_processing import THUMB_SIZE_WIDE, crop_resize, process_image, process_video
from app.models import User, UserRole
from app.models.media import Media
from app.models.recipe import Recipe, RecipeStep
from app.storage import storage

router = APIRouter(prefix="/api/media", tags=["media"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/x-msvideo"}
MAX_IMAGE_BYTES = 20 * 1024 * 1024   # 20 MB
MAX_VIDEO_BYTES = 1024 * 1024 * 1024  # 1 GB


def _check_owner(entity_type: str, entity_id: int, current_user: User, db: Session) -> None:
    """Raise 403 if user is not chefkoch/admin and not the recipe author."""
    if current_user.role in (UserRole.kuechenchef, UserRole.chefkoch, UserRole.admin):
        return
    if entity_type == "recipe":
        recipe = db.query(Recipe).filter(Recipe.id == entity_id).first()
        if not recipe or recipe.created_by != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Berechtigung")
    elif entity_type == "step":
        step = db.query(RecipeStep).filter(RecipeStep.id == entity_id).first()
        if not step:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Berechtigung")
        recipe = db.query(Recipe).filter(Recipe.id == step.recipe_id).first()
        if not recipe or recipe.created_by != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Berechtigung")
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Berechtigung")


# ── Upload image ──────────────────────────────────────────────────────────────

@router.post("/upload/image", response_model=MediaOut, status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile,
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail=f"Nicht unterstützter Medientyp: {content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Datei zu groß (max. 20 MB)")

    try:
        webp_bytes, thumbnail_bytes, width, height = process_image(file_bytes, file.filename or "upload")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Bildverarbeitung fehlgeschlagen: {e}")

    media_uuid = str(uuid.uuid4())
    storage_path = f"{entity_type}/{entity_id}/images/{media_uuid}.webp"
    thumb_path = f"{entity_type}/{entity_id}/images/thumbnails/{media_uuid}.webp"

    storage.save_file(webp_bytes, storage_path)
    storage.save_file(thumbnail_bytes, thumb_path)

    is_first = db.query(Media).filter(
        Media.entity_type == entity_type,
        Media.entity_id == entity_id,
        Media.deleted_at.is_(None),
    ).count() == 0

    media = Media(
        entity_type=entity_type,
        entity_id=entity_id,
        media_type="image",
        filename=f"{media_uuid}.webp",
        original_filename=file.filename,
        mime_type="image/webp",
        size_bytes=len(webp_bytes),
        width=width,
        height=height,
        processing_status="ready",
        is_primary=is_first,
        storage_path=storage_path,
        thumbnail_path=thumb_path,
        uploaded_by=current_user.id,
    )
    db.add(media)
    db.commit()
    db.refresh(media)
    return media


# ── Upload video ──────────────────────────────────────────────────────────────

@router.post("/upload/video", response_model=MediaOut, status_code=status.HTTP_201_CREATED)
async def upload_video(
    file: UploadFile,
    entity_type: str,
    entity_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status_code=415, detail=f"Nicht unterstützter Medientyp: {content_type}")

    # Stream to temp file to avoid loading full video into memory
    tmp_filename = f"/tmp/{uuid.uuid4()}_original"
    size = 0
    with open(tmp_filename, "wb") as tmp:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_VIDEO_BYTES:
                tmp.close()
                os.unlink(tmp_filename)
                raise HTTPException(status_code=413, detail="Datei zu groß (max. 1 GB)")
            tmp.write(chunk)

    media_uuid = str(uuid.uuid4())
    storage_path = f"{entity_type}/{entity_id}/videos/{media_uuid}.mp4"
    thumb_path = f"{entity_type}/{entity_id}/videos/thumbnails/{media_uuid}.webp"

    is_first = db.query(Media).filter(
        Media.entity_type == entity_type,
        Media.entity_id == entity_id,
        Media.deleted_at.is_(None),
    ).count() == 0

    media = Media(
        entity_type=entity_type,
        entity_id=entity_id,
        media_type="video",
        filename=f"{media_uuid}.mp4",
        original_filename=file.filename,
        mime_type="video/mp4",
        size_bytes=size,
        processing_status="processing",
        is_primary=is_first,
        storage_path=storage_path,
        uploaded_by=current_user.id,
    )
    db.add(media)
    db.commit()
    db.refresh(media)

    background_tasks.add_task(
        process_video,
        tmp_filename,
        storage_path,
        thumb_path,
        media.id,
        SessionLocal,
    )

    return media


# ── Update (sort_order) ───────────────────────────────────────────────────────

from pydantic import BaseModel as _Base

class _MediaUpdate(_Base):
    sort_order: int | None = None

@router.patch("/{media_id}", response_model=MediaOut)
def update_media(
    media_id: int,
    body: _MediaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    media = db.query(Media).filter(Media.id == media_id, Media.deleted_at.is_(None)).first()
    if not media:
        raise HTTPException(status_code=404, detail="Medium nicht gefunden")
    _check_owner(media.entity_type, media.entity_id, current_user, db)
    if body.sort_order is not None:
        media.sort_order = body.sort_order
    db.commit()
    db.refresh(media)
    return media


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status/{media_id}", response_model=MediaStatusOut)
def get_status(
    media_id: int,
    db: Session = Depends(get_db),
    _: User | None = Depends(get_optional_user),
):
    media = db.query(Media).filter(Media.id == media_id, Media.deleted_at.is_(None)).first()
    if not media:
        raise HTTPException(status_code=404, detail="Medium nicht gefunden")
    return media


# ── Set primary ───────────────────────────────────────────────────────────────

@router.patch("/{media_id}/set-primary", response_model=MediaOut)
def set_primary(
    media_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    media = db.query(Media).filter(Media.id == media_id, Media.deleted_at.is_(None)).first()
    if not media:
        raise HTTPException(status_code=404, detail="Medium nicht gefunden")

    _check_owner(media.entity_type, media.entity_id, current_user, db)

    # Clear primary flag for all media of same entity
    db.query(Media).filter(
        Media.entity_type == media.entity_type,
        Media.entity_id == media.entity_id,
        Media.deleted_at.is_(None),
    ).update({"is_primary": False})

    media.is_primary = True
    db.commit()
    db.refresh(media)
    return media


# ── Crop thumbnail (recipe title images only) ────────────────────────────────

class _CropBox(_Base):
    x: float
    y: float
    width: float
    height: float


@router.post("/{media_id}/crop-thumbnail", response_model=MediaOut)
def crop_thumbnail(
    media_id: int,
    body: _CropBox,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    media = db.query(Media).filter(Media.id == media_id, Media.deleted_at.is_(None)).first()
    if not media:
        raise HTTPException(status_code=404, detail="Medium nicht gefunden")

    _check_owner(media.entity_type, media.entity_id, current_user, db)

    if media.entity_type != "recipe" or media.media_type != "image":
        raise HTTPException(status_code=400, detail="Bildausschnitt nur für Rezept-Titelbilder möglich")

    full_path = os.path.join(settings.media_root, media.storage_path)
    try:
        with open(full_path, "rb") as f:
            img = Image.open(io.BytesIO(f.read())).convert("RGB")
        thumb = crop_resize(img, (body.x, body.y, body.width, body.height), *THUMB_SIZE_WIDE)
        buf = io.BytesIO()
        thumb.save(buf, format="WEBP", quality=80)
        thumbnail_bytes = buf.getvalue()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Bildausschnitt fehlgeschlagen: {e}")

    old_thumb_path = media.thumbnail_path
    new_thumb_path = f"{media.entity_type}/{media.entity_id}/images/thumbnails/{uuid.uuid4()}.webp"
    storage.save_file(thumbnail_bytes, new_thumb_path)
    if old_thumb_path:
        storage.delete_file(old_thumb_path)

    media.thumbnail_path = new_thumb_path
    db.commit()
    db.refresh(media)
    return media


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(
    media_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    media = db.query(Media).filter(Media.id == media_id, Media.deleted_at.is_(None)).first()
    if not media:
        raise HTTPException(status_code=404, detail="Medium nicht gefunden")

    _check_owner(media.entity_type, media.entity_id, current_user, db)

    media.deleted_at = datetime.now(timezone.utc)
    db.commit()


# ── List by entity ────────────────────────────────────────────────────────────

@router.get("/entity/{entity_type}/{entity_id}", response_model=list[MediaOut])
def list_entity_media(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
):
    return (
        db.query(Media)
        .filter(
            Media.entity_type == entity_type,
            Media.entity_id == entity_id,
            Media.deleted_at.is_(None),
        )
        .order_by(Media.is_primary.desc(), Media.sort_order.asc(), Media.id.asc())
        .all()
    )

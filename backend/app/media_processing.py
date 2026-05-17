import asyncio
import io
import logging
import os

from app.config import settings

logger = logging.getLogger(__name__)

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    pass

from PIL import Image

MAX_LONG_SIDE = 2400
THUMB_SIZE = 400


def _center_crop_resize(img: Image.Image, size: int) -> Image.Image:
    min_dim = min(img.width, img.height)
    left = (img.width - min_dim) // 2
    top = (img.height - min_dim) // 2
    img = img.crop((left, top, left + min_dim, top + min_dim))
    return img.resize((size, size), Image.LANCZOS)


def process_image(file_bytes: bytes, original_filename: str) -> tuple[bytes, bytes, int, int]:
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")

    w, h = img.size
    if max(w, h) > MAX_LONG_SIDE:
        if w >= h:
            new_w, new_h = MAX_LONG_SIDE, int(h * MAX_LONG_SIDE / w)
        else:
            new_w, new_h = int(w * MAX_LONG_SIDE / h), MAX_LONG_SIDE
        img = img.resize((new_w, new_h), Image.LANCZOS)

    w, h = img.size

    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=85)
    webp_bytes = buf.getvalue()

    thumb = _center_crop_resize(img, THUMB_SIZE)
    tbuf = io.BytesIO()
    thumb.save(tbuf, format="WEBP", quality=80)
    thumbnail_bytes = tbuf.getvalue()

    return webp_bytes, thumbnail_bytes, w, h


async def process_video(
    tmp_path: str,
    storage_path: str,
    thumb_path: str,
    media_id: int,
    session_factory,
) -> None:
    from app.models.media import Media

    db = session_factory()
    try:
        output_path = os.path.join(settings.media_root, storage_path)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y",
            "-i", tmp_path,
            "-c:v", "libx264", "-crf", "23", "-preset", "fast",
            "-c:a", "aac", "-movflags", "+faststart",
            output_path,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            raise RuntimeError(stderr.decode(errors="replace"))

        # Thumbnail: first frame, center-crop 400x400
        thumb_full = os.path.join(settings.media_root, thumb_path)
        os.makedirs(os.path.dirname(thumb_full), exist_ok=True)
        thumb_proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y",
            "-i", tmp_path,
            "-ss", "00:00:01", "-vframes", "1",
            "-vf", f"crop='min(iw,ih)':'min(iw,ih)',scale={THUMB_SIZE}:{THUMB_SIZE}",
            thumb_full,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await thumb_proc.communicate()

        media = db.query(Media).filter(Media.id == media_id).first()
        if media:
            media.processing_status = "ready"
            media.thumbnail_path = thumb_path
            db.commit()

    except Exception as e:
        logger.error("Video processing failed for media %d: %s", media_id, e)
        media = db.query(Media).filter(Media.id == media_id).first()
        if media:
            media.processing_status = "error"
            db.commit()
    finally:
        db.close()
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

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

from PIL import Image, ImageFilter

MAX_LONG_SIDE = 2400
THUMB_SIZE = 400
THUMB_SIZE_WIDE = (480, 270)  # 16:9, used for custom-cropped recipe title thumbnails


def _center_crop_resize(img: Image.Image, size: int) -> Image.Image:
    min_dim = min(img.width, img.height)
    left = (img.width - min_dim) // 2
    top = (img.height - min_dim) // 2
    img = img.crop((left, top, left + min_dim, top + min_dim))
    return img.resize((size, size), Image.LANCZOS)


def crop_resize(img: Image.Image, box: tuple[float, float, float, float], target_w: int, target_h: int) -> Image.Image:
    x, y, w, h = box
    left = max(0, min(x, img.width))
    top = max(0, min(y, img.height))
    right = max(left + 1, min(x + w, img.width))
    bottom = max(top + 1, min(y + h, img.height))
    img = img.crop((round(left), round(top), round(right), round(bottom)))
    return img.resize((target_w, target_h), Image.LANCZOS)


def crop_blur_pad(img: Image.Image, box: tuple[float, float, float, float], target_w: int, target_h: int) -> Image.Image:
    """Crop the selected region, place it centered on a target_w x target_h canvas,
    and fill the surrounding area with a heavily blurred, cover-fitted copy of the original image."""
    x, y, w, h = box
    left = max(0, min(x, img.width))
    top = max(0, min(y, img.height))
    right = max(left + 1, min(x + w, img.width))
    bottom = max(top + 1, min(y + h, img.height))
    crop = img.crop((round(left), round(top), round(right), round(bottom)))

    target_ratio = target_w / target_h

    # Scale the crop down to fit within the canvas, preserving its aspect ratio
    crop_ratio = crop.width / crop.height
    if crop_ratio > target_ratio:
        fit_w, fit_h = target_w, round(target_w / crop_ratio)
    else:
        fit_h, fit_w = target_h, round(target_h * crop_ratio)
    crop_resized = crop.resize((max(1, fit_w), max(1, fit_h)), Image.LANCZOS)

    # Cover-fill the canvas with the original image, then blur it for the background
    bg_ratio = img.width / img.height
    if bg_ratio > target_ratio:
        bg_h, bg_w = target_h, round(target_h * bg_ratio)
    else:
        bg_w, bg_h = target_w, round(target_w / bg_ratio)
    bg = img.resize((bg_w, bg_h), Image.LANCZOS)
    bg_left = (bg_w - target_w) // 2
    bg_top = (bg_h - target_h) // 2
    bg = bg.crop((bg_left, bg_top, bg_left + target_w, bg_top + target_h))
    bg = bg.filter(ImageFilter.GaussianBlur(radius=20))

    paste_x = (target_w - crop_resized.width) // 2
    paste_y = (target_h - crop_resized.height) // 2
    bg.paste(crop_resized, (paste_x, paste_y))
    return bg


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

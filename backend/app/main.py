import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.categories.router import router as categories_router
from app.config import settings
from app.favorites.router import router as favorites_router
from app.media.router import router as media_router
from app.modules.router import router as modules_router
from app.plants.ingredient_map_router import router as plant_ingredient_map_router
from app.plants.ingredient_map_seed import seed_plant_ingredient_map
from app.plants.router import router as plants_router
from app.plants.seed import seed_plant_data
from app.recipes.access_router import router as access_router
from app.ratings.router import router as ratings_router
from app.recipes.router import router as recipes_router
from app.recipes.versions_router import router as versions_router
from app.seasonal.matcher import run_seasonal_matching
from app.seasonal.router import router as seasonal_router
from app.seed import seed_admin, seed_garbage_collector
from app.tags.router import router as tags_router
from app.users.router import admin_router, router as users_router

logger = logging.getLogger(__name__)


async def _cleanup_deleted_users() -> None:
    from app.database import SessionLocal
    from app.models import Recipe, User

    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        expired_users = (
            db.query(User)
            .filter(
                User.deleted_at.isnot(None),
                User.deleted_at < cutoff,
            )
            .all()
        )
        if not expired_users:
            return
        gc = db.query(User).filter(User.email == "system@piengines.internal").first()
        gc_id = gc.id if gc else None
        for user in expired_users:
            if gc_id:
                db.query(Recipe).filter(Recipe.created_by == user.id).update(
                    {"created_by": gc_id, "author_id": gc_id}
                )
            db.delete(user)
        db.commit()
        logger.info("Cleaned up %d expired user(s)", len(expired_users))
    except Exception:
        db.rollback()
        logger.exception("Cleanup of deleted users failed")
    finally:
        db.close()


async def _warn_expiring_users() -> None:
    from app.database import SessionLocal
    from app.email_service import send_account_deleted_reminder
    from app.models import User
    from app.models.user import UserRole

    db = SessionLocal()
    try:
        warn_date = datetime.now(timezone.utc) - timedelta(days=27)
        warn_end = datetime.now(timezone.utc) - timedelta(days=26)
        expiring = (
            db.query(User)
            .filter(
                User.deleted_at.isnot(None),
                User.deleted_at >= warn_date,
                User.deleted_at < warn_end,
            )
            .all()
        )
        if not expiring:
            return
        admins = (
            db.query(User)
            .filter(User.role.in_([UserRole.kuechenchef, UserRole.chefkoch, UserRole.admin]), User.is_active.is_(True))
            .all()
        )
        for user in expiring:
            days = 30 - (datetime.now(timezone.utc) - user.deleted_at).days
            for admin in admins:
                send_account_deleted_reminder(admin.email, user.name, days)
    except Exception:
        logger.exception("Warning of expiring users failed")
    finally:
        db.close()


async def _cleanup_deleted_recipes() -> None:
    from sqlalchemy import or_

    from app.database import SessionLocal
    from app.models import Recipe
    from app.models.media import Media
    from app.storage import storage

    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        expired = (
            db.query(Recipe)
            .filter(
                Recipe.deleted_at.isnot(None),
                Recipe.deleted_at < cutoff,
            )
            .all()
        )
        if not expired:
            return
        count = 0
        for recipe in expired:
            step_ids = [s.id for s in recipe.steps]
            conditions = [(Media.entity_type == "recipe") & (Media.entity_id == recipe.id)]
            if step_ids:
                conditions.append(
                    (Media.entity_type == "step") & Media.entity_id.in_(step_ids)
                )
            media_records = db.query(Media).filter(or_(*conditions)).all()
            for m in media_records:
                if m.storage_path:
                    storage.delete_file(m.storage_path)
                if m.thumbnail_path:
                    storage.delete_file(m.thumbnail_path)
                db.delete(m)
            for img in recipe.images:
                if img.file_path:
                    storage.delete_file(img.file_path)
            for vid in recipe.videos:
                if vid.file_path:
                    storage.delete_file(vid.file_path)
            db.delete(recipe)
            count += 1
        db.commit()
        logger.info("Recipe GC: permanently deleted %d expired recipe(s)", count)
    except Exception:
        db.rollback()
        logger.exception("Recipe GC failed")
    finally:
        db.close()


async def _seed_disposable_domains() -> None:
    import httpx

    from app.database import SessionLocal
    from app.models.access import DisposableEmailDomain

    db = SessionLocal()
    try:
        if db.query(DisposableEmailDomain).count() > 0:
            return
        url = (
            "https://raw.githubusercontent.com/disposable-email-domains/"
            "disposable-email-domains/master/disposable_email_blocklist.conf"
        )
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
        domains = [
            line.strip()
            for line in resp.text.splitlines()
            if line.strip() and not line.startswith("#")
        ]
        capped = domains[:5000]
        for domain in capped:
            db.add(DisposableEmailDomain(domain=domain))
        db.commit()
        logger.info("Loaded %d disposable email domains", len(capped))
    except Exception:
        db.rollback()
        logger.warning("Could not load disposable email domains")
    finally:
        db.close()


async def _run_seasonal_matching() -> None:
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        run_seasonal_matching(db)
    except Exception:
        logger.exception("Seasonal matching failed")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_admin()
    seed_garbage_collector()

    from app.database import SessionLocal
    from app.models import Plant

    db = SessionLocal()
    try:
        plants_table_empty = db.query(Plant).first() is None
    finally:
        db.close()
    if plants_table_empty:
        seed_plant_data()

    # Kräuterschule Phase 4: Brücke Pflanze<->Zutat (Full-Reload, idempotent).
    # Läuft nach dem Plant-Seed und unabhängig davon, ob Pflanzen neu geseedet wurden.
    seed_plant_ingredient_map()

    await _seed_disposable_domains()

    scheduler = AsyncIOScheduler()
    # Daily cleanup of permanently expired (30-day) deleted users
    scheduler.add_job(_cleanup_deleted_users, "cron", hour=3, minute=0)
    # Daily warning for users about to be permanently deleted (3 days remaining)
    scheduler.add_job(_warn_expiring_users, "cron", hour=3, minute=15)
    # Daily hard-delete of recipes soft-deleted more than 30 days ago
    scheduler.add_job(_cleanup_deleted_recipes, "cron", hour=4, minute=0)
    # AI-based seasonal tagging of recipes, every 3 days
    scheduler.add_job(_run_seasonal_matching, "interval", days=3)
    scheduler.start()

    from app.database import SessionLocal
    from app.models import Recipe

    db = SessionLocal()
    try:
        needs_tagging = any(
            recipe.seasonal_tags is None or len(recipe.seasonal_tags) == 0
            for recipe in db.query(Recipe).all()
        )
    finally:
        db.close()
    if needs_tagging:
        asyncio.create_task(_run_seasonal_matching())

    yield

    scheduler.shutdown(wait=False)


app = FastAPI(title="PiEngines Recipes API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(recipes_router)
app.include_router(ratings_router)
app.include_router(modules_router)
app.include_router(versions_router)
app.include_router(access_router)
app.include_router(categories_router)
app.include_router(tags_router)
app.include_router(media_router)
app.include_router(favorites_router)
app.include_router(seasonal_router)
app.include_router(users_router)
app.include_router(admin_router)
app.include_router(plants_router)
app.include_router(plant_ingredient_map_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}

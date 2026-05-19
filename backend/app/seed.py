import logging
import secrets

from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.config import settings
from app.database import SessionLocal
from app.models import User, UserRole

logger = logging.getLogger(__name__)


def seed_admin() -> None:
    db: Session = SessionLocal()
    try:
        if db.query(User).filter(User.role.in_([UserRole.kuechenchef, UserRole.admin])).first():
            return

        if len(settings.admin_password) < 8:
            logger.error("ADMIN_PASSWORD must be at least 8 characters — admin seed skipped")
            return

        admin = User(
            name="Admin",
            email=settings.admin_email,
            password_hash=hash_password(settings.admin_password),
            role=UserRole.kuechenchef,
            is_active=True,
            status="active",
        )
        db.add(admin)
        db.commit()
        logger.info("Admin user created: %s", settings.admin_email)
    except ProgrammingError:
        db.rollback()
        logger.info("Seed skipped — database tables not yet created (run migrations first)")
    except Exception:
        db.rollback()
        logger.exception("Failed to seed admin user")
    finally:
        db.close()


def seed_garbage_collector() -> None:
    db: Session = SessionLocal()
    try:
        gc_email = "system@piengines.internal"
        if db.query(User).filter(User.email == gc_email).first():
            return
        gc_user = User(
            name="System",
            email=gc_email,
            password_hash=secrets.token_urlsafe(64),
            role=UserRole.kuechenchef,
            is_active=False,
            status="active",
        )
        db.add(gc_user)
        db.commit()
        logger.info("Garbage collector user created")
    except ProgrammingError:
        db.rollback()
        logger.info("GC seed skipped — database tables not yet created")
    except Exception:
        db.rollback()
        logger.exception("Failed to create garbage collector user")
    finally:
        db.close()

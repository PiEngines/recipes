import logging

from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.config import settings
from app.database import SessionLocal
from app.models import User, UserRole

logger = logging.getLogger(__name__)


def seed_admin() -> None:
    db: Session = SessionLocal()
    try:
        if db.query(User).filter(User.role == UserRole.admin).first():
            return

        if len(settings.admin_password) < 8:
            logger.error("ADMIN_PASSWORD must be at least 8 characters — admin seed skipped")
            return

        admin = User(
            name="Admin",
            email=settings.admin_email,
            password_hash=hash_password(settings.admin_password),
            role=UserRole.admin,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        logger.info("Admin user created: %s", settings.admin_email)
    except Exception:
        db.rollback()
        logger.exception("Failed to seed admin user")
    finally:
        db.close()

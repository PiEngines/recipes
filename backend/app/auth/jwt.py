from datetime import datetime, timedelta, timezone

from jose import jwt

from app.config import settings

_ALGORITHM = "HS256"
_ACCESS_EXPIRE_MINUTES = 60
_REFRESH_EXPIRE_DAYS = 7


def create_access_token(user_id: int) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=_ACCESS_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "exp": expires, "type": "access"},
        settings.secret_key,
        algorithm=_ALGORITHM,
    )


def create_refresh_token(user_id: int) -> str:
    expires = datetime.now(timezone.utc) + timedelta(days=_REFRESH_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": str(user_id), "exp": expires, "type": "refresh"},
        settings.secret_key,
        algorithm=_ALGORITHM,
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[_ALGORITHM])

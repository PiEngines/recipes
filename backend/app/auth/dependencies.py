from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.auth.jwt import decode_token
from app.database import get_db
from app.models import User
from app.models.user import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
_optional_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise unauthorized
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise unauthorized
    except JWTError:
        raise unauthorized

    user = db.query(User).filter(User.id == int(user_id), User.is_active.is_(True)).first()
    if user is None:
        raise unauthorized
    return user


def get_optional_user(
    token: str | None = Depends(_optional_oauth2),
    db: Session = Depends(get_db),
) -> User | None:
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        user_id: str | None = payload.get("sub")
        if not user_id:
            return None
    except JWTError:
        return None
    return db.query(User).filter(User.id == int(user_id), User.is_active.is_(True)).first()


def require_chefkoch(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.chefkoch, UserRole.admin):
        raise HTTPException(status_code=403, detail="Chefkoch-Zugriff erforderlich")
    return current_user


# Alias for backward compatibility
require_admin = require_chefkoch


def require_koch_or_above(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.chefkoch, UserRole.koch, UserRole.admin, UserRole.autor):
        raise HTTPException(status_code=403, detail="Zugriff verweigert")
    return current_user


# Alias for backward compatibility
require_admin_or_autor = require_koch_or_above

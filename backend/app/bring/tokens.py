"""Signierte, ablaufende Tokens für den Bring!-Klon-Link.

Der Klon-Endpoint ist öffentlich — der Bring!-Server kann sich nicht anmelden.
Autorisiert wird deshalb der Token selbst: signiert mit dem vorhandenen
`secret_key`, mit kurzer Laufzeit und eigenem `type`, damit ein Access-Token
hier nicht als Share-Token durchgeht (und umgekehrt).
"""
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import settings

_ALGORITHM = "HS256"
_TOKEN_TYPE = "bring_share"


def create_share_token(recipe_id: int) -> str:
    expires = datetime.now(timezone.utc) + timedelta(seconds=settings.bring_link_ttl_seconds)
    return jwt.encode(
        {"rid": recipe_id, "exp": expires, "type": _TOKEN_TYPE},
        settings.secret_key,
        algorithm=_ALGORITHM,
    )


def read_share_token(token: str) -> int | None:
    """Rezept-ID aus einem gültigen Token, sonst None (ungültig/abgelaufen/falscher Typ)."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[_ALGORITHM])
    except JWTError:
        return None
    if payload.get("type") != _TOKEN_TYPE:
        return None
    rid = payload.get("rid")
    return rid if isinstance(rid, int) else None

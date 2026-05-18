import threading
import time

from fastapi import HTTPException, status

_store: dict[str, list[float]] = {}
_lock = threading.Lock()


def check_rate_limit(key: str, max_calls: int, window_seconds: int) -> None:
    now = time.time()
    with _lock:
        timestamps = _store.get(key, [])
        timestamps = [t for t in timestamps if now - t < window_seconds]
        if len(timestamps) >= max_calls:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Zu viele Anfragen. Bitte später erneut versuchen.",
            )
        timestamps.append(now)
        _store[key] = timestamps

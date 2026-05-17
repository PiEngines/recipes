import os
from abc import ABC, abstractmethod

from app.config import settings


class BaseStorage(ABC):
    @abstractmethod
    def save_file(self, file_bytes: bytes, storage_path: str) -> None: ...

    @abstractmethod
    def delete_file(self, storage_path: str) -> None: ...

    @abstractmethod
    def get_url(self, storage_path: str) -> str: ...


class LocalStorage(BaseStorage):
    def __init__(self, media_root: str | None = None):
        self.media_root = media_root or settings.media_root

    def save_file(self, file_bytes: bytes, storage_path: str) -> None:
        full_path = os.path.join(self.media_root, storage_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "wb") as f:
            f.write(file_bytes)

    def delete_file(self, storage_path: str) -> None:
        full_path = os.path.join(self.media_root, storage_path)
        try:
            os.unlink(full_path)
        except FileNotFoundError:
            pass

    def get_url(self, storage_path: str) -> str:
        return f"/media/{storage_path}"


storage = LocalStorage()

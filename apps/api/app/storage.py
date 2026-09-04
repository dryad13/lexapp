from __future__ import annotations

import secrets
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class StoredFile:
    stored_filename: str
    path: str


class LocalStorage:
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _safe_name(self, ext: str) -> str:
        ext = ext.lower().strip().replace("/", "").replace("\\", "")
        token = secrets.token_urlsafe(24)
        return f"{token}{ext}"

    def save_bytes(self, content: bytes, ext: str) -> StoredFile:
        name = self._safe_name(ext)
        dest = (self.base_dir / name).resolve()
        if not str(dest).startswith(str(self.base_dir)):
            raise ValueError("Invalid path")
        dest.write_bytes(content)
        return StoredFile(stored_filename=name, path=str(dest))

    def open_path(self, stored_filename: str) -> str:
        candidate = (self.base_dir / stored_filename).resolve()
        if not str(candidate).startswith(str(self.base_dir)):
            raise ValueError("Invalid path")
        if not candidate.exists():
            raise FileNotFoundError("Missing file")
        return str(candidate)

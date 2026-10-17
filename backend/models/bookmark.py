"""
Bookmark domain model (a row of Supabase public.User_Bookmark).

Layer: domain / core.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from models.user import format_iso_utc

# Users may only bookmark schedules (V3-US2).
BOOKMARK_TYPES = ("SCHEDULE",)


@dataclass(frozen=True)
class Bookmark:
    id: str
    user_id: str
    entity_id: str
    entity_type: str
    saved_at: str | datetime | None = None

    @classmethod
    def from_record(cls, record: dict[str, Any]) -> "Bookmark":
        return cls(
            id=str(record.get("id", "")),
            user_id=str(record.get("user_id", "")),
            entity_id=str(record.get("entity_id", "")),
            entity_type=str(record.get("entity_type", "")),
            saved_at=record.get("saved_at"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "entity_id": self.entity_id,
            "entity_type": self.entity_type,
            "saved_at": format_iso_utc(self.saved_at),
        }

"""
User domain model.

Layer: domain / core.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


def format_iso_utc(dt_val: str | datetime | None) -> str | None:
    """Format any valid datetime or ISO string to UTC ISO-8601 with trailing Z."""
    if not dt_val:
        return None

    if isinstance(dt_val, datetime):
        if dt_val.tzinfo is None:
            dt_val = dt_val.replace(tzinfo=timezone.utc)
        else:
            dt_val = dt_val.astimezone(timezone.utc)
        return dt_val.strftime("%Y-%m-%dT%H:%M:%SZ")

    if isinstance(dt_val, str):
        # Already standard Z format without subseconds, e.g. 2026-10-14T15:27:00Z
        clean = dt_val.strip().replace(" ", "T")
        try:
            parsed = datetime.fromisoformat(clean)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            else:
                parsed = parsed.astimezone(timezone.utc)
            return parsed.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            return dt_val

    return str(dt_val)


@dataclass(frozen=True)
class User:
    id: str
    email: str
    full_name: str
    role: str
    created_at: str | datetime | None = None
    last_login: str | datetime | None = None

    @classmethod
    def from_record(cls, record: dict[str, Any]) -> "User":
        return cls(
            id=str(record.get("id", "")),
            email=str(record.get("email", "")),
            full_name=str(record.get("full_name") or ""),
            role=str(record.get("role", "STUDENT")),
            created_at=record.get("created_at"),
            last_login=record.get("last_login"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "created_at": format_iso_utc(self.created_at),
            "last_login": format_iso_utc(self.last_login),
        }

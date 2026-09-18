from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any


SCHEDULE_TYPES = {"COURSE", "EXAM", "ACTIVITY"}


@dataclass(frozen=True)
class Schedule:
    id: str
    type: str
    title: str
    description: str | None
    course_code: str | None
    organizer: str | None
    start_at: str
    end_at: str
    time_zone: str
    is_all_day: bool
    recurrence_rule: str | None
    room_id: str
    location_text: str | None
    status: str
    source_id: str | None
    source_type: str | None

    @classmethod
    def from_payload(
        cls,
        schedule_id: str,
        room_id: str,
        payload: dict[str, Any],
        *,
        existing: "Schedule | None" = None,
    ) -> "Schedule":
        required = [
            "type",
            "title",
            "start_at",
            "end_at",
            "time_zone",
            "status",
        ]

        missing = [
            field
            for field in required
            if field not in payload
        ]

        if missing:
            raise ValueError(
                f"Missing required fields: {', '.join(missing)}"
            )

        schedule_type = payload["type"]

        if schedule_type not in SCHEDULE_TYPES:
            raise ValueError(
                f"Invalid schedule type: {schedule_type}"
            )

        title = payload["title"]

        if not isinstance(title, str) or not title.strip():
            raise ValueError("title must be a non-empty string")

        start_at = payload["start_at"]
        end_at = payload["end_at"]

        try:
            start = datetime.fromisoformat(start_at)
            end = datetime.fromisoformat(end_at)
        except (TypeError, ValueError) as exc:
            raise ValueError(
                "start_at and end_at must be valid ISO 8601 datetime"
            ) from exc

        if end <= start:
            raise ValueError("end_at must be after start_at")

        is_all_day = payload.get(
            "is_all_day",
            existing.is_all_day if existing else False,
        )

        if not isinstance(is_all_day, bool):
            raise ValueError("is_all_day must be a boolean")

        return cls(
            id=schedule_id,
            type=schedule_type,
            title=title,
            description=payload.get(
                "description",
                existing.description if existing else None,
            ),

            course_code=payload.get(
                "course_code",
                existing.course_code if existing else None,
            ),

            organizer=payload.get(
                "organizer",
                existing.organizer if existing else None,
            ),
            start_at=start_at,
            end_at=end_at,
            time_zone=payload["time_zone"],
            is_all_day=is_all_day,
            recurrence_rule=payload.get(
                "recurrence_rule",
                existing.recurrence_rule if existing else None,
            ),
            room_id=room_id,
            location_text=(
                payload.get(
                    "location_text",
                    existing.location_text if existing else None,
                )
            ),
            status=payload["status"],
            source_id=(
                payload.get(
                    "source_id",
                    existing.source_id if existing else None,
                )
            ),
            source_type=(
                payload.get(
                    "source_type",
                    existing.source_type if existing else None,
                )
            ),
        )

    @classmethod
    def from_raw(cls, raw: dict[str, Any]) -> "Schedule":
        return cls(
            id=raw["id"],
            type=raw["type"],
            title=raw["title"],
            description=raw.get("description"),
            course_code=raw.get("course_code"),
            organizer=raw.get("organizer"),
            start_at=raw["start_at"],
            end_at=raw["end_at"],
            time_zone=raw["time_zone"],
            is_all_day=raw.get("is_all_day", False),
            recurrence_rule=raw.get("recurrence_rule"),
            room_id=raw["room_id"],
            location_text=raw.get("location_text"),
            status=raw["status"],
            source_id=raw.get("source_id"),
            source_type=raw.get("source_type"),
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
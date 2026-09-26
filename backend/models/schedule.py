"""
Schedule domain model and domain rules.

Layer: domain / core. Knows nothing about HTTP or DynamoDB -- the PK/SK/GSI
layout for a schedule lives in `repositories/`, not here.
"""

from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Any

from dateutil.rrule import rrulestr

from errors import MissingParameters, ValidationError

SCHEDULE_TYPES = {"COURSE", "EXAM", "ACTIVITY"}
TYPES = SCHEDULE_TYPES
STATUSES = {"CONFIRM", "TENTATIVE", "CANCELLED"}

_REQUIRED = ("type", "title", "start_at", "end_at")

# Fields a caller may set. Anything else in the payload is dropped, so a POST
# cannot inject its own `id`, `PK` or `created_at`.
_ALLOWED = _REQUIRED + (
    "description",
    "course_code",
    "organizer",
    "time_zone",
    "recurrence_rule",
    "status",
)

# Expand-on-write turns one POST into one DynamoDB item per occurrence, so the
# rule has to be finite and the count has to be bounded.
MAX_OCCURRENCES = 200


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


def parse_time(value: str) -> datetime:
    """`"2026-09-16T13:00:00+07:00"` -> an aware datetime."""
    try:
        return datetime.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(
            f"'{value}' is not an ISO 8601 datetime"
        ) from exc


def overlaps(
    a_start: datetime,
    a_end: datetime,
    b_start: datetime,
    b_end: datetime,
) -> bool:
    """True when the half-open intervals [a) and [b) share any instant."""
    return a_start < b_end and b_start < a_end


def validate(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Check an inbound POST body and return the normalised schedule.

    Raises ValidationError / MissingParameters -- never returns a partial
    record and never returns None.
    """
    if not isinstance(payload, dict):
        raise ValidationError("Request body must be a JSON object")

    missing = [name for name in _REQUIRED if not payload.get(name)]

    if missing:
        raise MissingParameters(missing)

    schedule_type = str(payload["type"]).upper()

    if schedule_type not in TYPES:
        raise ValidationError(
            f"type must be one of: {', '.join(sorted(TYPES))}"
        )

    status = str(payload.get("status") or "CONFIRM").upper()

    if status not in STATUSES:
        raise ValidationError(
            f"status must be one of: {', '.join(sorted(STATUSES))}"
        )

    if parse_time(payload["start_at"]) >= parse_time(payload["end_at"]):
        raise ValidationError("start_at must be before end_at")

    schedule = {
        name: payload[name] for name in _ALLOWED if payload.get(name)
    }
    schedule["type"] = schedule_type
    schedule["status"] = status

    return schedule


def occurrences(
    start_at: str,
    end_at: str,
    recurrence_rule: str | None = None,
) -> list[tuple[str, str]]:
    """
    `[(start, end), ...]` -- one pair per occurrence, each the same length as
    the first. No rule means a single occurrence.
    """
    if not recurrence_rule:
        return [(start_at, end_at)]

    start = parse_time(start_at)
    duration = parse_time(end_at) - start
    rule_text = str(recurrence_rule).upper()

    # An RRULE with neither COUNT nor UNTIL repeats forever, and expanding it
    # on write would never terminate.
    if "COUNT=" not in rule_text and "UNTIL=" not in rule_text:
        raise ValidationError(
            "recurrence_rule must carry COUNT or UNTIL so the series is finite"
        )

    try:
        rule = rrulestr(recurrence_rule, dtstart=start)
    except (ValueError, TypeError) as exc:
        raise ValidationError(
            f"'{recurrence_rule}' is not a valid RFC 5545 RRULE"
        ) from exc

    slots = [
        (moment.isoformat(), (moment + duration).isoformat())
        for moment in rule
    ]

    if len(slots) > MAX_OCCURRENCES:
        raise ValidationError(
            f"recurrence_rule expands to {len(slots)} occurrences; "
            f"the limit is {MAX_OCCURRENCES}"
        )

    return slots


def series_window(slots: list[tuple[str, str]]) -> tuple[str, str]:
    """
    The GSI4 query window that covers every occurrence in `slots`.

    GSI4 is keyed on `start_at`, so the lower bound is widened by a day to
    catch a booking that started before the series and is still running.

    ponytail: the 24h lookback assumes no single booking is longer than a day.
    If that stops holding, put `end_at` in the sort key instead of widening.
    """
    lower = parse_time(slots[0][0]) - timedelta(days=1)

    return lower.isoformat(), slots[-1][1]

"""
Schedule service
- get_room_schedules() list occurrences in a time window
- create_schedule()    validate, check overlap, store
- update_schedule()    replace a schedule
- delete_schedule()    delete a schedule
"""

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from errors import ScheduleConflict, ScheduleNotFound
from models.schedule import (
    can_share,
    occurrences,
    overlaps,
    parse_time,
    to_contract,
    to_utc,
    validate,
)
from ports.schedule_source import ScheduleSource


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_item(schedule: dict[str, Any], room_id: str) -> dict[str, Any]:
    """A validated schedule -> a new stored item."""
    now = _now()

    return {
        **schedule,
        "id": str(uuid4()),
        "room_id": room_id,
        "created_at": now,
        "updated_at": now,
    }


class ScheduleService:

    def __init__(self, source: ScheduleSource):
        self.source = source

    def get_room_schedules(
        self,
        room_id: str,
        start: str,
        end: str,
        schedule_type: str | None = None,
    ) -> dict[str, Any]:
        """AP15: one row per occurrence inside [start, end)."""
        schedule_type = schedule_type.upper() if schedule_type else None
        window_start, window_end = parse_time(start), parse_time(end)

        items = self.source.find_overlapping(
            room_id, to_utc(window_start), to_utc(window_end), schedule_type
        )
        data = sorted(
            (
                {**to_contract(item), "start_at": s.isoformat(), "end_at": e.isoformat()}
                for item in items
                for s, e in occurrences(
                    item["start_at"], item["end_at"], item.get("recurrence_rule")
                )
                if overlaps(s, e, window_start, window_end)
            ),
            key=lambda row: parse_time(row["start_at"]),
        )

        return {
            "data": data,
            "meta": {"room_id": room_id, "type": schedule_type, "count": len(data)},
        }

    def create_schedule(self, room_id: str, payload: dict[str, Any]) -> str:
        """AP21: validate, reject overlaps, store the series as one item."""
        schedule = validate(payload)
        self._reject_conflicts(room_id, schedule)

        self.source.save_schedule(new_item(schedule, room_id))

        return "created"

    def update_schedule(
        self,
        room_id: str,
        schedule_id: str,
        payload: dict[str, Any],
    ) -> str:
        """AP22: full replace of an existing schedule, same rules as create."""
        existing = self.source.get_schedule(room_id, schedule_id)

        if existing is None:
            raise ScheduleNotFound(schedule_id)

        schedule = validate(payload)
        self._reject_conflicts(room_id, schedule, ignore_id=schedule_id)

        self.source.save_schedule(
            {
                **schedule,
                "id": schedule_id,
                "room_id": room_id,
                "created_at": existing.get("created_at"),
                "updated_at": _now(),
            }
        )

        return "updated"

    def delete_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> str:
        """AP23: delete an existing schedule."""
        if self.source.get_schedule(room_id, schedule_id) is None:
            raise ScheduleNotFound(schedule_id)

        self.source.delete_schedule(room_id, schedule_id)

        return "deleted"

    # -- internals ---------------------------------------------------------

    def _reject_conflicts(
        self,
        room_id: str,
        schedule: dict[str, Any],
        ignore_id: str | None = None,
    ) -> None:
        """Check schedule overlap."""
        # ponytail: O(n*m) pairwise scan; sort-and-sweep if series grow large.
        mine = occurrences(
            schedule["start_at"], schedule["end_at"], schedule["recurrence_rule"]
        )
        booked = [
            slot
            for item in self.source.find_overlapping(
                room_id, to_utc(schedule["start_at"]), schedule["series_end_at"]
            )
            if item.get("status") == "CONFIRM"
            and item.get("id") != ignore_id
            and not can_share(item.get("type"), schedule["type"])
            for slot in occurrences(
                item["start_at"], item["end_at"], item.get("recurrence_rule")
            )
        ]

        for start, end in mine:
            if any(overlaps(start, end, b_start, b_end) for b_start, b_end in booked):
                raise ScheduleConflict(room_id, start.isoformat(), end.isoformat())

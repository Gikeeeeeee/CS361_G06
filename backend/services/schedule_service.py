"""
Schedule use cases.

Layer: application. Depends on the ScheduleSource port, never on boto3.

A recurring schedule is ONE stored item carrying its `recurrence_rule`; the
frontend expands it. The backend expands series only to detect conflicts.
"""

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from errors import ScheduleConflict, ScheduleNotFound
from models.schedule import (
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
        """AP15: every schedule for a room whose series touches [start, end)."""
        schedule_type = schedule_type.upper() if schedule_type else None

        items = self.source.find_overlapping(
            room_id, to_utc(start), to_utc(end), schedule_type
        )
        data = sorted(
            (to_contract(item) for item in items),
            key=lambda schedule: parse_time(schedule["start_at"]),
        )

        return {
            "data": data,
            "meta": {"room_id": room_id, "type": schedule_type, "count": len(data)},
        }

    def create_schedule(self, room_id: str, payload: dict[str, Any]) -> str:
        """AP21: validate, reject overlaps, store the series as one item."""
        schedule = validate(payload)
        self._reject_conflicts(room_id, schedule)

        now = _now()
        self.source.save_schedule(
            {
                **schedule,
                "id": str(uuid4()),
                "room_id": room_id,
                "created_at": now,
                "updated_at": now,
            }
        )

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
        """
        Raise if any occurrence lands on a CONFIRM booking in the same room.

        One query fetches every series touching the new one's span; both sides
        are expanded (each capped at MAX_OCCURRENCES) and compared pairwise.

        ponytail: O(n*m) pairwise scan; sort-and-sweep if series grow large.
        """
        mine = occurrences(
            schedule["start_at"], schedule["end_at"], schedule["recurrence_rule"]
        )
        booked = [
            slot
            for item in self.source.find_overlapping(
                room_id, to_utc(schedule["start_at"]), schedule["series_end_at"]
            )
            if item.get("status") == "CONFIRM" and item.get("id") != ignore_id
            for slot in occurrences(
                item["start_at"], item["end_at"], item.get("recurrence_rule")
            )
        ]

        for start, end in mine:
            if any(overlaps(start, end, b_start, b_end) for b_start, b_end in booked):
                raise ScheduleConflict(room_id, start.isoformat(), end.isoformat())

"""
Schedule use cases.

Layer: application. Depends on the ScheduleSource port, never on boto3.
"""

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from errors import InvalidSchedule, ScheduleConflict, ScheduleNotFound
from models.schedule import (
    Schedule,
    occurrences,
    overlaps,
    parse_time,
    series_window,
    validate,
)
from ports.schedule_source import ScheduleSource


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
        """AP15: every schedule for a room that starts within [start, end)."""
        # Reject a malformed window here rather than letting DynamoDB compare
        # it as an opaque string and return an empty list.
        parse_time(start)
        parse_time(end)

        return {
            "schedules": self.source.find_by_room_and_time_range(
                room_id, start, end, schedule_type
            )
        }

    def create_schedule(self, room_id: str, payload: dict[str, Any]) -> str:
        """
        AP21: validate, expand the recurrence rule, reject overlaps, store.

        Expand-on-write: a recurring booking becomes one item per occurrence,
        each with its own `start_at`, so GSI4 can answer a time range with a
        single BETWEEN instead of re-deriving the rule on every read.
        """
        schedule = validate(payload)

        slots = occurrences(
            schedule["start_at"],
            schedule["end_at"],
            schedule.get("recurrence_rule"),
        )

        self._reject_conflicts(room_id, slots)

        now = datetime.now(timezone.utc).isoformat()

        self.source.save(
            [
                {
                    **schedule,
                    "id": str(uuid4()),
                    "room_id": room_id,
                    "start_at": start_at,
                    "end_at": end_at,
                    "created_at": now,
                    "updated_at": now,
                }
                for start_at, end_at in slots
            ]
        )

        return "created"

    def update_schedule(
        self,
        room_id: str,
        schedule_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Update an existing schedule."""
        existing_raw = self.source.get_schedule(
            room_id,
            schedule_id,
        )

        if existing_raw is None:
            raise ScheduleNotFound(schedule_id)

        existing = Schedule.from_raw(existing_raw)

        try:
            schedule = Schedule.from_payload(
                schedule_id,
                room_id,
                payload,
                existing=existing,
            )
        except ValueError as exc:
            raise InvalidSchedule(str(exc)) from exc

        return self.source.update_schedule(
            schedule.to_dict()
        )

    def delete_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> str:
        """Delete an existing schedule."""
        existing = self.source.get_schedule(
            room_id,
            schedule_id,
        )

        if existing is None:
            raise ScheduleNotFound(schedule_id)

        self.source.delete_schedule(
            room_id,
            schedule_id,
        )

        return "deleted"

    # -- internals ---------------------------------------------------------

    def _reject_conflicts(
        self,
        room_id: str,
        slots: list[tuple[str, str]],
    ) -> None:
        """
        Raise if any occurrence lands on a CONFIRM booking in the same room.

        One query covers the whole series: fetching per occurrence would be a
        round trip per week of a term.
        """
        window_start, window_end = series_window(slots)

        booked = [
            (parse_time(item["start_at"]), parse_time(item["end_at"]))
            for item in self.source.find_by_room_and_time_range(
                room_id, window_start, window_end
            )
            if item.get("status") == "CONFIRM"
        ]

        for start_at, end_at in slots:
            start, end = parse_time(start_at), parse_time(end_at)

            for booked_start, booked_end in booked:
                if overlaps(start, end, booked_start, booked_end):
                    raise ScheduleConflict(room_id, start_at, end_at)

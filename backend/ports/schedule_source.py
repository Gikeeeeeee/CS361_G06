"""
Driven port for schedule storage.

`services/` depends on THIS, never on `repositories/` -- same arrangement as
`building_source.BuildingSource`, so the DynamoDB adapter can be swapped for an
in-memory fake without touching a service.

Layer: port (owned by the core).
"""

from typing import Any, Protocol


class ScheduleSource(Protocol):
    """Read and write access to schedules, wherever they happen to live."""

    def get_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> dict[str, Any] | None:
        """Fetch a single schedule by room and schedule id."""
        ...

    def save_schedule(self, schedule: dict[str, Any]) -> None:
        """Create or fully replace one schedule (a series is one item)."""
        ...

    def delete_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> None:
        """Delete a schedule item by room and schedule id."""
        ...

    def find_overlapping(
        self,
        room_id: str,
        start: str,
        end: str,
        schedule_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Every schedule for `room_id` whose series touches `[start, end)`:
        it starts before `end` and its `series_end_at` is after `start`.
        `start`/`end` are UTC strings from `models.schedule.to_utc`.
        """
        ...

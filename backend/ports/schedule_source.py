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

    def update_schedule(
        self,
        schedule: dict[str, Any],
    ) -> dict[str, Any]:
        """Update an existing schedule item."""
        ...

    def delete_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> None:
        """Delete a schedule item by room and schedule id."""
        ...

    def find_by_room_and_time_range(
        self,
        room_id: str,
        start: str,
        end: str,
        schedule_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Every schedule for `room_id` that STARTS within `[start, end)`,
        optionally narrowed to one type.
        """
        ...

    def save(self, schedules: list[dict[str, Any]]) -> None:
        """Store every schedule given. One schedule is a list of one."""
        ...

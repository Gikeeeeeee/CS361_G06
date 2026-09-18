"""
Driven port for schedule storage.

`services/` depends on THIS, never on `repositories/` -- same arrangement as
`building_source.BuildingSource`, so the DynamoDB adapter can be swapped for an
in-memory fake without touching a service.

Two methods, because there are two endpoints. Conflict detection is not a third
method: it is `find_by_room_and_time_range` over the window being booked, with
the CONFIRM filter applied in the service. Whether one item or fifteen are
written is likewise not the port's business, so `save` always takes a list.

Layer: port (owned by the core).
"""

from typing import Any, Protocol


class ScheduleSource(Protocol):
    """Read and write access to schedules, wherever they happen to live."""

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

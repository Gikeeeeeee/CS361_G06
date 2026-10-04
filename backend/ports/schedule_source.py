from typing import Any, Protocol


class ScheduleSource(Protocol):
    def list_schedules(
        self,
        limit: int,
        next_token: str | None = None,
    ) -> tuple[list[dict[str, Any]], str | None]:
        """List schedule series using opaque pagination."""
        ...

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

    def save_schedules(self, schedules: list[dict[str, Any]]) -> None:
        """Create many schedules in bulk (CSV import)."""
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
        """Check schedule overlap."""
        ...

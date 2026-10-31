from typing import Any, Protocol


class ScheduleSource(Protocol):
    def list_schedules(
        self,
        limit: int,
        next_token: str | None = None,
        schedule_type: str | None = None,
    ) -> tuple[list[dict[str, Any]], str | None]:
        """List schedule series using opaque pagination and an optional type filter."""
        ...

    def get_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> dict[str, Any] | None:
        """Fetch a single schedule by room and schedule id."""
        ...

    def get_schedule_by_id(
        self,
        schedule_id: str,
    ) -> dict[str, Any] | None:
        """Fetch a single schedule across all rooms by schedule id."""
        ...

    def get_room_version(self, room_id: str) -> int:
        """Read the room's write counter (0 if never written)."""
        ...

    def save_schedule(
        self,
        schedule: dict[str, Any],
        version: int,
        delete_from: str | None = None,
    ) -> None:
        """Create or replace one schedule; raise ScheduleWriteRace if the room
        version moved since `version` was read."""
        ...

    def save_schedules(
        self, schedules: list[dict[str, Any]], versions: dict[str, int]
    ) -> None:
        """Create many schedules (CSV import), same race rule per room."""
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

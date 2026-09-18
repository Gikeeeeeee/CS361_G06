from typing import Any, Protocol


class ScheduleSource(Protocol):
    def get_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> dict[str, Any] | None:
        ...

    def update_schedule(
        self,
        schedule: dict[str, Any],
    ) -> dict[str, Any]:
        ...

    def delete_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> None:
        ...
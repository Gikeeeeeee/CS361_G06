from typing import Any

from errors import InvalidSchedule, ScheduleNotFound
from models.schedule import Schedule
from ports.schedule_source import ScheduleSource


class ScheduleService:
    def __init__(self, source: ScheduleSource):
        self.source = source

    def update_schedule(
        self,
        room_id: str,
        schedule_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
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
    ) -> None:
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
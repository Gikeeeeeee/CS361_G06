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

from errors import NotFoundError, ScheduleConflict, ScheduleNotFound
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

    def __init__(
        self,
        source: ScheduleSource,
        room_service: Any = None,
        room_repo: Any = None,
        room_source: Any = None,
    ):
        self.source = source
        self.room_service = room_service
        self.room_repo = room_repo or room_source

    def get_schedule(self, room_id: str, schedule_id: str) -> dict[str, Any]:
        """Fetch a single schedule item with nested room details."""
        schedule = self.source.get_schedule(room_id, schedule_id)
        if schedule is None or schedule.get("room_id") != room_id:
            raise ScheduleNotFound(schedule_id)

        room_data = None
        if self.room_service is not None:
            try:
                room_data = self.room_service.get_room(room_id)
            except NotFoundError:
                raise
            except Exception:
                room_data = None
        elif self.room_repo is not None:
            try:
                if hasattr(self.room_repo, "get_room"):
                    raw = self.room_repo.get_room(room_id)
                    if raw:
                        b_name = None
                        if hasattr(self.room_repo, "get_building") and raw.get("building_id"):
                            b = self.room_repo.get_building(str(raw["building_id"]))
                            b_name = b.get("name") if b else None
                        elif isinstance(raw.get("building"), dict):
                            b_name = raw["building"].get("name")
                        else:
                            b_name = raw.get("building_name")
                        room_data = {
                            "id": raw.get("id", room_id),
                            "name": raw.get("name") or raw.get("room_number"),
                            "building_name": b_name,
                        }
            except NotFoundError:
                raise
            except Exception:
                room_data = None
        else:
            try:
                from repositories.room_repository import RoomRepository
                from services.room_service import RoomService

                room_data = RoomService(RoomRepository()).get_room(room_id)
            except NotFoundError:
                raise
            except Exception:
                room_data = None

        building_name = None
        room_name = None
        if room_data:
            if isinstance(room_data.get("building"), dict):
                building_name = room_data["building"].get("name")
            elif "building_name" in room_data:
                building_name = room_data.get("building_name")

            room_name = room_data.get("name") or room_data.get("room_number")

        contract = to_contract(schedule)
        contract["room"] = {
            "id": (room_data.get("id") if room_data else None) or room_id,
            "name": room_name,
            "building_name": building_name,
        }
        return contract

    def get_schedules(
        self,
        limit: int = 20,
        next_token: str | None = None,
        schedule_type: str | None = None,
    ) -> dict[str, Any]:
        """List stored schedule series without expanding recurrence."""
        items, next_token = self.source.list_schedules(limit, next_token, schedule_type)
        data = [to_contract(item) for item in items]

        return {
            "data": data,
            "meta": {"count": len(data), "next_token": next_token},
        }

    def get_room_schedules(
        self,
        room_id: str,
        start: str,
        end: str,
        schedule_type: str | None = None,
        user_role: str = "GUEST",
    ) -> dict[str, Any]:
        """AP15: one row per occurrence inside [start, end)."""
        schedule_type = schedule_type.upper() if schedule_type else None
        role = str(user_role).upper() if user_role else "GUEST"
        window_start, window_end = parse_time(start), parse_time(end)

        items = self.source.find_overlapping(
            room_id, to_utc(window_start), to_utc(window_end), schedule_type
        )
        data = []
        for item in items:
            contract = to_contract(item)
            for s, e in occurrences(
                item["start_at"], item["end_at"], item.get("recurrence_rule")
            ):
                if overlaps(s, e, window_start, window_end):
                    row = {
                        **contract,
                        "start_at": s.isoformat(),
                        "end_at": e.isoformat(),
                    }
                    if row.get("visibility") == "INTERNAL" and role != "STAFF":
                        row["title"] = "Reserved"
                        row["description"] = None
                        row["organizer"] = None
                    data.append(row)

        data.sort(key=lambda row: parse_time(row["start_at"]))

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

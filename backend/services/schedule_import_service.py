"""
Schedule CSV import: every row is saved, or none.
- import_csv()  parse, validate, check rooms and overlaps, then preview or save
"""

from collections import defaultdict
from functools import cache
from typing import Any, NamedTuple

from errors import (
    BookingConflict,
    BuildingNotFound,
    CsvTooManyOccurrences,
    ImportConflict,
    ImportRejected,
    MissingParameters,
    NotFoundError,
    RoomNotFound,
    RowOverlap,
    ValidationError,
)
from models.room import find_room_by_number
from models.schedule import (
    MAX_IMPORT_OCCURRENCES,
    can_share,
    check_room_type,
    occurrences,
    overlaps,
    parse_csv,
    to_utc,
    validate,
)
from ports.building_source import BuildingSource
from ports.schedule_source import ScheduleSource
from services.schedule_service import new_item

DEFAULTS = {"time_zone": "Asia/Bangkok", "status": "CONFIRM"}


class Entry(NamedTuple):
    """One valid CSV row, resolved to its room."""

    row: int
    building: str
    room: str
    room_id: str
    schedule: dict[str, Any]
    slots: list


def _detail(row: int, building: str | None, room: str | None, reason: str) -> dict:
    return {"row": row, "building": building, "room": room, "reason": reason}


class ScheduleImportService:

    def __init__(self, buildings: BuildingSource, schedules: ScheduleSource):
        self.buildings = buildings
        self.schedules = schedules

    def import_csv(self, data: bytes, dry_run: bool) -> dict[str, Any]:
        """Preview ({rows}) or save ({created}); raise with details[] if any row fails."""
        get_building = cache(self.buildings.get_building)
        entries, problems = [], []

        for number, row in parse_csv(data):
            try:
                entries.append(self._entry(number, row, get_building))
            except (ValidationError, NotFoundError) as exc:
                problems.append(_detail(number, row.get("building"), row.get("room"), exc.message))

        total = sum(len(entry.slots) for entry in entries)

        if total > MAX_IMPORT_OCCURRENCES:
            raise CsvTooManyOccurrences(total, MAX_IMPORT_OCCURRENCES)

        if problems:
            raise ImportRejected(problems)

        rooms = defaultdict(list)

        for entry in entries:
            rooms[entry.room_id].append(entry)

        conflicts: dict[int, dict] = {}

        for room_id, group in rooms.items():
            self._find_conflicts(room_id, group, conflicts)

        if conflicts:
            raise ImportConflict([conflicts[row] for row in sorted(conflicts)])

        if not dry_run:
            self.schedules.save_schedules(
                [new_item(entry.schedule, entry.room_id) for entry in entries]
            )
            return {"created": len(entries)}

        return {
            "rows": [
                {
                    "row": entry.row,
                    "building": entry.building,
                    "room": entry.room,
                    "type": entry.schedule["type"],
                    "title": entry.schedule["title"],
                    "start_at": start.isoformat(),
                    "end_at": end.isoformat(),
                    "organizer": entry.schedule["organizer"],
                }
                for entry in entries
                for start, end in entry.slots
            ]
        }

    # -- internals ---------------------------------------------------------

    @staticmethod
    def _entry(number: int, row: dict, get_building) -> Entry:
        """Validate one row and resolve its room; raise on the first problem."""
        missing = [name for name in ("building", "room") if not row.get(name)]

        if missing:
            raise MissingParameters(missing)

        schedule = validate({**row, **DEFAULTS})
        building = get_building(row["building"])

        if building is None:
            raise BuildingNotFound(row["building"])

        room = find_room_by_number(building, row["room"])

        if room is None:
            raise RoomNotFound(row["room"])

        check_room_type(row["room"], room.get("type"), schedule["type"])
        slots = occurrences(
            schedule["start_at"], schedule["end_at"], schedule["recurrence_rule"]
        )

        return Entry(number, row["building"], row["room"], room["id"], schedule, slots)

    def _find_conflicts(self, room_id: str, group: list[Entry], conflicts: dict) -> None:
        """Record the first overlap per row: within the file, then against stored bookings."""

        def flag(entry: Entry, error: ValidationError) -> None:
            conflicts.setdefault(
                entry.row, _detail(entry.row, entry.building, entry.room, error.message)
            )

        slots = sorted(
            ((start, end, entry) for entry in group for start, end in entry.slots),
            key=lambda slot: slot[0],
        )

        # Sweep: compare each slot with every earlier slot still running.
        active = []

        for start, end, entry in slots:
            active = [slot for slot in active if slot[1] > start]

            for other_start, other_end, other in active:
                if other is not entry and not can_share(
                    other.schedule["type"], entry.schedule["type"]
                ):
                    flag(entry, RowOverlap(other.row, other_start, other_end))

            active.append((start, end, entry))

        booked = [
            (item, start, end)
            for item in self.schedules.find_overlapping(
                room_id, to_utc(slots[0][0]), to_utc(max(slot[1] for slot in slots))
            )
            if item.get("status") == "CONFIRM"
            for start, end in occurrences(
                item["start_at"], item["end_at"], item.get("recurrence_rule")
            )
        ]

        # ponytail: O(slots * booked) scan; sort-and-sweep if rooms get busy.
        for start, end, entry in slots:
            for item, booked_start, booked_end in booked:
                if overlaps(start, end, booked_start, booked_end) and not can_share(
                    item.get("type"), entry.schedule["type"]
                ):
                    flag(entry, BookingConflict(item.get("title"), booked_start, booked_end))

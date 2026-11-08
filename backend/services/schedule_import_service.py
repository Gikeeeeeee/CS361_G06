"""
Schedule CSV import: every row is validated before anything is saved, or the
whole file is rejected. Room versions guard against concurrent writes; the
write itself is not transactional (see ScheduleRepository.save_schedules).

Imports run as background jobs (#241) so a big file never hits API Gateway's
30 s timeout:
- submit()      check the file, store it, queue a job -> {job_id, status}
- run_job()     worker: claim the job, import, store the result
- get_job()     job status for polling
- import_csv()  parse, validate, check rooms and overlaps, then preview or save

A job may run more than once (async invokes are at-least-once, and a worker
that dies is retried). Its schedule ids are `imp-<job_id>-<row>`, so a rerun
overwrites its own rows instead of conflicting with them.
"""

import json
import time
from collections import defaultdict
from functools import cache
from typing import Any, NamedTuple
from uuid import uuid4

from errors import (
    AppError,
    BookingConflict,
    BuildingNotFound,
    CsvTooLarge,
    CsvTooManyOccurrences,
    ImportConflict,
    ImportJobNotFound,
    ImportJobStalled,
    ImportRejected,
    MissingParameters,
    NotFoundError,
    RoomNotFound,
    RowOverlap,
    ScheduleWriteRace,
    ValidationError,
)
from models.room import find_room_by_number
from models.schedule import (
    DEFAULT_TIME_ZONE,
    MAX_IMPORT_BYTES,
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

DEFAULTS = {"time_zone": DEFAULT_TIME_ZONE, "status": "CONFIRM"}

PENDING, PROCESSING, COMPLETED, FAILED = "PENDING", "PROCESSING", "COMPLETED", "FAILED"
JOB_TTL_SECONDS = 24 * 3600  # matches the S3 imports/ lifecycle (1 day)
LEASE_SECONDS = 330  # worker timeout (300 s) + margin; then a retry may reclaim
MAX_ATTEMPTS = 3  # first run + Lambda's 2 async retries
RACE_RETRIES = 3  # reruns when another write to a room lands mid-import


class Entry(NamedTuple):
    """One valid CSV row, resolved to its room."""

    row: int
    building: str
    room: str
    room_id: str
    schedule: dict[str, Any]
    slots: list


def _prefix(job_id: str) -> str:
    return f"imp-{job_id}-"


def _detail(row: int, building: str | None, room: str | None, reason: str) -> dict:
    return {"row": row, "building": building, "room": room, "reason": reason}


class ScheduleImportService:

    def __init__(self, buildings: BuildingSource, schedules: ScheduleSource, clock=time.time):
        self.buildings = buildings
        self.schedules = schedules
        self.clock = clock

    # -- jobs --------------------------------------------------------------

    def submit(self, data: bytes, dry_run: bool, created_by: str | None = None) -> dict:
        """Reject a bad file now (cheap checks only), else store it and queue a job."""
        if len(data) > MAX_IMPORT_BYTES:
            raise CsvTooLarge(len(data), MAX_IMPORT_BYTES)

        parse_csv(data)  # encoding / header / row-count errors still come back as 400

        job_id = str(uuid4())
        now = int(self.clock())
        self.schedules.put_import_object(f"{job_id}.csv", data)
        self.schedules.create_job({
            "job_id": job_id,
            "status": PENDING,
            "dry_run": dry_run,
            "created_by": created_by,
            "created_at": now,
            "updated_at": now,
            "attempts": 0,
            "expires_at": now + JOB_TTL_SECONDS,
        })
        self.schedules.dispatch_import(job_id)

        return {"job_id": job_id, "status": PENDING}

    def run_job(self, job_id: str) -> None:
        """Worker entry: one claimed run of the job; a lost claim does nothing."""
        token = str(uuid4())
        now = int(self.clock())
        job = self.schedules.claim_job(job_id, token, now, now + LEASE_SECONDS, MAX_ATTEMPTS)

        if job is None:
            return

        try:
            data = self.schedules.get_import_object(f"{job_id}.csv")
            outcome = {"result": self._import_with_retries(data, job["dry_run"], job_id)}
            status = COMPLETED
        except Exception as exc:  # every failure ends the job; only a crash is retried
            error = exc if isinstance(exc, AppError) else AppError()
            if not job["dry_run"]:
                self.schedules.delete_import_schedules(_prefix(job_id))
            outcome = {"error": error.to_dict()}
            status = FAILED

        self.schedules.put_import_object(
            f"{job_id}.result.json", json.dumps(outcome, ensure_ascii=False).encode("utf-8")
        )
        self.schedules.finish_job(job_id, token, status, int(self.clock()))

    def get_job(self, job_id: str) -> dict[str, Any]:
        """{job_id, status, dry_run, created_at, updated_at, result, error}."""
        job = self.schedules.get_job(job_id)

        if job is None:
            raise ImportJobNotFound(job_id)

        view = {
            "job_id": job_id,
            "status": job["status"],
            "dry_run": job["dry_run"],
            "created_at": job["created_at"],
            "updated_at": job["updated_at"],
            "result": None,
            "error": None,
        }

        if job["status"] in (COMPLETED, FAILED):
            stored = self.schedules.get_import_object(f"{job_id}.result.json")
            view.update(json.loads(stored) if stored else {})

        # Past the lease plus the retry window nothing will reclaim it: report
        # it as failed instead of leaving the client polling forever.
        elif job["status"] == PROCESSING and self.clock() > job["lease_until"] + LEASE_SECONDS:
            view.update(status=FAILED, error=ImportJobStalled().to_dict())

        return view

    def _import_with_retries(self, data: bytes, dry_run: bool, job_id: str) -> dict:
        for attempt in range(RACE_RETRIES):
            try:
                return self.import_csv(data, dry_run, job_id)
            except ScheduleWriteRace:
                if attempt == RACE_RETRIES - 1:
                    raise

    # -- import ------------------------------------------------------------

    def import_csv(self, data: bytes, dry_run: bool, job_id: str | None = None) -> dict[str, Any]:
        """Preview ({rows}) or save ({created}); raise with details[] if any row fails.

        With `job_id`, rows get stable ids and that job's own rows never count
        as conflicts, so a rerun after a partial write overwrites them.
        """
        own = _prefix(job_id) if job_id else None
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

        # Read before checking: a write that lands after this makes the save fail.
        versions = {room_id: self.schedules.get_room_version(room_id) for room_id in rooms}
        conflicts: dict[int, dict] = {}

        for room_id, group in rooms.items():
            self._find_conflicts(room_id, group, conflicts, own)

        if conflicts:
            raise ImportConflict([conflicts[row] for row in sorted(conflicts)])

        if not dry_run:
            self.schedules.save_schedules(
                [
                    new_item(entry.schedule, entry.room_id, own and f"{own}{entry.row}")
                    for entry in entries
                ],
                versions,
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

    def _find_conflicts(
        self, room_id: str, group: list[Entry], conflicts: dict, own: str | None = None
    ) -> None:
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
            and not (own and str(item.get("id", "")).startswith(own))
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

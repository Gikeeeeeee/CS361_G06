import json
import threading
from datetime import date, timedelta

import pytest

from errors import (
    CsvEmpty,
    CsvMissingColumns,
    CsvNotUtf8,
    CsvTooManyOccurrences,
    CsvTooLarge,
    CsvTooManyRows,
    ImportConflict,
    ImportJobNotFound,
    ImportRejected,
    ScheduleWriteRace,
)
from models.schedule import CSV_HEADER
from services.schedule_import_service import ScheduleImportService
from services.schedule_service import ScheduleService
from tests.conftest import FakeScheduleSource, race

pytestmark = pytest.mark.unit

LAB = "lc4-room-uuid-1"  # LC4 room 201


def _row(room="201", type="COURSE", day="2026-10-05", start="09:00", end="12:00",
         rule="", building="LC4", title="CS361 Lecture"):
    return (f"{building},{room},{type},{title},{day}T{start}:00+07:00,"
            f"{day}T{end}:00+07:00,CS361,Dr. A,{rule}")


def _csv(*rows: str) -> bytes:
    return "\n".join([",".join(CSV_HEADER), *rows]).encode("utf-8")


def _days(n: int) -> list[str]:
    return [str(date(2026, 1, 1) + timedelta(days=i)) for i in range(n)]


@pytest.fixture
def store():
    return FakeScheduleSource()


@pytest.fixture
def service(campus_source, store):
    return ScheduleImportService(campus_source, store)


def _book(store, **overrides):
    """Store one existing booking in LC4 201 through the normal create path."""
    payload = {"type": "COURSE", "title": "Existing", "start_at": "2026-10-05T10:00:00+07:00",
               "end_at": "2026-10-05T11:00:00+07:00", "time_zone": "Asia/Bangkok",
               "status": "CONFIRM", **overrides}
    ScheduleService(store).create_schedule(LAB, payload)


def _reasons(exc_info) -> dict[int, str]:
    return {detail["row"]: detail["reason"] for detail in exc_info.value.details}


# -- happy path ---------------------------------------------------------------


def test_dry_run_previews_every_occurrence_and_writes_nothing(service, store):
    result = service.import_csv(_csv(_row(rule="FREQ=WEEKLY;COUNT=3")), dry_run=True)

    assert len(result["rows"]) == 3
    assert result["rows"][0] == {
        "row": 2, "building": "LC4", "room": "201", "type": "COURSE",
        "title": "CS361 Lecture", "start_at": "2026-10-05T09:00:00+07:00",
        "end_at": "2026-10-05T12:00:00+07:00", "organizer": "Dr. A",
    }
    assert store.schedules == []


def test_import_saves_one_series_per_row(service, store):
    result = service.import_csv(
        _csv(_row(rule="FREQ=WEEKLY;COUNT=15"), _row(room="205", type="ACTIVITY")),
        dry_run=False,
    )

    assert result == {"created": 2}
    lecture = store.schedules[0]
    assert lecture["room_id"] == LAB
    assert lecture["recurrence_rule"] == "FREQ=WEEKLY;COUNT=15"
    assert lecture["time_zone"] == "Asia/Bangkok" and lecture["status"] == "CONFIRM"
    assert lecture["id"] and lecture["created_at"] and lecture["updated_at"]

    window = ("2026-10-01T00:00:00+07:00", "2027-02-01T00:00:00+07:00")
    assert ScheduleService(store).get_room_schedules(LAB, *window)["meta"]["count"] == 15


def test_bom_blank_rows_and_padded_cells_are_accepted(service):
    data = b"\xef\xbb\xbf" + _csv(",,,,,,,,", _row(room=" 201 "))

    assert service.import_csv(data, dry_run=True)["rows"][0]["row"] == 3


# -- file-level (400, no details) ------------------------------------------------


@pytest.mark.parametrize(
    "data, error",
    [
        (b"", CsvEmpty),
        (",".join(CSV_HEADER).encode(), CsvEmpty),
        (b"building,room\nLC4,201", CsvMissingColumns),
        (_csv(_row(title="ทดสอบ")).decode().encode("cp874"), CsvNotUtf8),
    ],
)
def test_file_level_errors(service, data, error):
    with pytest.raises(error) as exc_info:
        service.import_csv(data, dry_run=True)

    assert exc_info.value.details is None


def test_missing_column_is_named(service):
    with pytest.raises(CsvMissingColumns, match="end_at"):
        service.import_csv(b"building,room,type,title,start_at\n", dry_run=True)


def test_row_limit_is_300(service):
    assert len(service.import_csv(_csv(*map(lambda d: _row(day=d), _days(300))), True)["rows"]) == 300

    with pytest.raises(CsvTooManyRows):
        service.import_csv(_csv(*map(lambda d: _row(day=d), _days(301))), dry_run=True)


def test_occurrence_limit_is_2000(service):
    daily = [_row(start=f"{8 + i:02d}:00", end=f"{8 + i:02d}:30", rule="FREQ=DAILY;COUNT=200")
             for i in range(10)]

    assert len(service.import_csv(_csv(*daily), dry_run=True)["rows"]) == 2000

    with pytest.raises(CsvTooManyOccurrences):
        service.import_csv(_csv(*daily, _row(day="2028-01-01")), dry_run=True)


# -- row-level (400 with details) ---------------------------------------------------


def test_every_bad_row_is_reported_and_nothing_is_written(service, store):
    data = _csv(
        _row(type="PARTY"),                    # 2
        *[_row(day=d) for d in _days(8)],      # 3..10 valid
        _row(title="", day="2026-11-01"),      # 11
    )

    with pytest.raises(ImportRejected) as exc_info:
        service.import_csv(data, dry_run=False)

    assert set(_reasons(exc_info)) == {2, 11}
    assert store.schedules == []


def test_rows_with_missing_or_extra_cells_are_rejected(service, store):
    data = _csv(_row(), "LC4,COURSE", _row(day="2026-10-06") + ",extra")

    with pytest.raises(ImportRejected) as exc_info:
        service.import_csv(data, dry_run=False)

    reasons = _reasons(exc_info)
    assert set(reasons) == {3, 4}
    assert "2 cell(s)" in reasons[3] and "10 cell(s)" in reasons[4]
    assert store.schedules == []


def test_row_number_survives_a_multiline_cell(service):
    data = _csv(_row(title='"Line 1\nLine 2"'), _row(type="PARTY", day="2026-10-06"))

    with pytest.raises(ImportRejected) as exc_info:
        service.import_csv(data, dry_run=True)

    assert set(_reasons(exc_info)) == {3}


def test_time_without_offset_is_rejected(service):
    data = _csv("LC4,201,COURSE,X,2026-10-05 09:00,2026-10-05 12:00,,,")

    with pytest.raises(ImportRejected) as exc_info:
        service.import_csv(data, dry_run=True)

    assert "offset" in _reasons(exc_info)[2]


@pytest.mark.parametrize(
    "row, reason",
    [
        (_row(building="LC9"), "Building 'LC9' not found"),
        (_row(room="999"), "Room '999' not found"),
        (_row(room=LAB), f"Room '{LAB}' not found"),  # uuids are not accepted
        (_row(room="205", type="COURSE"), "Room '205' (OFFICE) only allows ACTIVITY."),
        (_row(room="205", type="EXAM"), "only allows ACTIVITY"),
        (_row(room="R2", type="ACTIVITY"), "Room 'R2' (RESTROOM) cannot be booked."),
        (_row(room=""), "Missing required parameter(s): room"),
    ],
)
def test_room_rules(service, row, reason):
    with pytest.raises(ImportRejected) as exc_info:
        service.import_csv(_csv(row), dry_run=True)

    assert reason in _reasons(exc_info)[2]


def test_unknown_room_type_cannot_be_booked(service, campus_source):
    campus_source.get_building("LC4")["floors"][0]["rooms"][0]["type"] = "ROOFTOP"

    with pytest.raises(ImportRejected, match="1 row"):
        service.import_csv(_csv(_row()), dry_run=True)


def test_activity_in_office_is_allowed(service):
    assert service.import_csv(_csv(_row(room="205", type="ACTIVITY")), dry_run=True)["rows"]


# -- overlaps (409) -----------------------------------------------------------------


def test_rows_overlapping_in_the_file_conflict(service):
    with pytest.raises(ImportConflict) as exc_info:
        service.import_csv(_csv(_row(), _row(start="11:00", end="13:00")), dry_run=True)

    assert _reasons(exc_info) == {3: "Overlaps row 2 (2026-10-05 09:00–12:00)."}
    assert "uuid" not in json.dumps(exc_info.value.details)


def test_sweep_checks_every_running_slot_not_just_the_previous(service):
    data = _csv(_row(), _row(type="EXAM", start="10:00", end="11:00"),
                _row(start="11:30", end="12:00"))

    with pytest.raises(ImportConflict) as exc_info:
        service.import_csv(data, dry_run=True)

    assert _reasons(exc_info) == {4: "Overlaps row 2 (2026-10-05 09:00–12:00)."}


def test_overlapping_a_confirmed_booking_conflicts(service, store):
    _book(store)

    with pytest.raises(ImportConflict) as exc_info:
        service.import_csv(_csv(_row()), dry_run=True)

    assert _reasons(exc_info)[2] == "Overlaps existing booking 'Existing' (2026-10-05 10:00–11:00)."


@pytest.mark.parametrize("status", ["TENTATIVE", "CANCELLED"])
def test_unconfirmed_bookings_do_not_block(service, store, status):
    _book(store, status=status)

    assert service.import_csv(_csv(_row()), dry_run=True)["rows"]


def test_exam_may_take_over_a_course(service, store):
    _book(store)

    assert service.import_csv(_csv(_row(type="EXAM")), dry_run=True)["rows"]


def test_db_window_spans_every_row_of_the_room(service, store):
    _book(store)
    data = _csv(_row(day="2026-10-20"), _row())  # newest first

    with pytest.raises(ImportConflict) as exc_info:
        service.import_csv(data, dry_run=True)

    assert set(_reasons(exc_info)) == {3}


def test_row_errors_win_over_conflicts_without_querying(service, store, monkeypatch):
    monkeypatch.setattr(store, "find_overlapping", lambda *a, **k: pytest.fail("queried"))

    with pytest.raises(ImportRejected):
        service.import_csv(_csv(_row(), _row(), _row(type="PARTY")), dry_run=True)


def test_import_racing_a_single_booking_saves_only_one(service, store):
    store.check_barrier = threading.Barrier(2)  # both pass the check first
    payload = {"type": "COURSE", "title": "Walk-in", "start_at": "2026-10-05T10:00:00+07:00",
               "end_at": "2026-10-05T11:00:00+07:00", "time_zone": "Asia/Bangkok",
               "status": "CONFIRM"}

    results = race(
        lambda: service.import_csv(_csv(_row()), dry_run=False),
        lambda: ScheduleService(store).create_schedule(LAB, payload),
    )

    assert sum(isinstance(r, ScheduleWriteRace) for r in results) == 1
    assert len(store.schedules) == 1


# -- background jobs (#241) ----------------------------------------------------

NOW = 1_800_000_000


@pytest.fixture
def jobs(campus_source, store):
    """Service with a fixed clock; `jobs.clock = ...` moves time."""
    return ScheduleImportService(campus_source, store, clock=lambda: NOW)


def _submit_and_run(jobs, data, dry_run=False):
    job_id = jobs.submit(data, dry_run, created_by="staff-1")["job_id"]
    jobs.run_job(job_id)
    return job_id, jobs.get_job(job_id)


def test_submit_stores_the_file_and_queues_a_job(jobs, store):
    data = _csv(_row())
    submitted = jobs.submit(data, dry_run=False, created_by="staff-1")

    job_id = submitted["job_id"]
    assert submitted == {"job_id": job_id, "status": "PENDING"}
    assert store.objects[f"{job_id}.csv"] == data
    assert store.dispatched == [job_id]
    assert store.jobs[job_id]["created_by"] == "staff-1"
    assert store.jobs[job_id]["expires_at"] == NOW + 24 * 3600
    assert store.schedules == []  # nothing is imported until the worker runs


@pytest.mark.parametrize(
    "data, error",
    [(b"x" * (256 * 1024 + 1), CsvTooLarge), (b"building,room\nLC4,201", CsvMissingColumns)],
    ids=["too-large", "missing-columns"],
)
def test_bad_files_are_rejected_before_queueing(jobs, store, data, error):
    with pytest.raises(error):
        jobs.submit(data, dry_run=False)

    assert store.jobs == {} and store.objects == {} and store.dispatched == []


def test_job_completes_with_stable_ids(jobs, store):
    job_id, job = _submit_and_run(jobs, _csv(_row(), _row(room="205", type="ACTIVITY")))

    assert job["status"] == "COMPLETED"
    assert job["result"] == {"created": 2} and job["error"] is None
    assert sorted(s["id"] for s in store.schedules) == [f"imp-{job_id}-2", f"imp-{job_id}-3"]


def test_dry_run_job_returns_the_preview_and_writes_nothing(jobs, store):
    _, job = _submit_and_run(jobs, _csv(_row(rule="FREQ=WEEKLY;COUNT=3")), dry_run=True)

    assert job["status"] == "COMPLETED" and job["dry_run"] is True
    assert len(job["result"]["rows"]) == 3
    assert store.schedules == []


def test_failed_job_keeps_the_row_details(jobs, store):
    _book(store)
    _, job = _submit_and_run(jobs, _csv(_row()))

    assert job["status"] == "FAILED"
    assert job["error"]["code"] == "SCHEDULE_CONFLICT"
    assert job["error"]["details"][0]["row"] == 2
    assert [s["title"] for s in store.schedules] == ["Existing"]


def test_duplicate_delivery_runs_the_job_once(jobs, store, monkeypatch):
    job_id, _ = _submit_and_run(jobs, _csv(_row()))
    monkeypatch.setattr(jobs, "import_csv", lambda *a: pytest.fail("ran twice"))

    jobs.run_job(job_id)  # the same async event delivered again

    assert jobs.get_job(job_id)["status"] == "COMPLETED"


def test_rerun_after_a_crash_does_not_conflict_with_its_own_rows(jobs, store):
    job_id, _ = _submit_and_run(jobs, _csv(_row(), _row(room="205", type="ACTIVITY")))
    # Crash after the rows were written, before the job was marked done.
    store.jobs[job_id].update(status="PROCESSING", lease_until=NOW - 1)

    jobs.run_job(job_id)  # Lambda's retry

    job = jobs.get_job(job_id)
    assert job["status"] == "COMPLETED" and job["result"] == {"created": 2}
    assert len(store.schedules) == 2  # overwritten, not duplicated
    assert store.jobs[job_id]["attempts"] == 2


def test_a_live_lease_blocks_a_second_worker(jobs, store, monkeypatch):
    job_id = jobs.submit(_csv(_row()), dry_run=False)["job_id"]
    store.jobs[job_id].update(status="PROCESSING", lease_until=NOW + 100, attempts=1)
    monkeypatch.setattr(jobs, "import_csv", lambda *a: pytest.fail("lease ignored"))

    jobs.run_job(job_id)

    assert jobs.get_job(job_id)["status"] == "PROCESSING"


def test_write_race_is_retried(jobs, store, monkeypatch):
    save = store.save_schedules
    calls = []

    def flaky(schedules, versions):
        calls.append(1)
        if len(calls) == 1:
            raise ScheduleWriteRace()
        save(schedules, versions)

    monkeypatch.setattr(store, "save_schedules", flaky)
    _, job = _submit_and_run(jobs, _csv(_row()))

    assert job["status"] == "COMPLETED" and len(calls) == 2


def test_write_race_gives_up_after_three_tries(jobs, store, monkeypatch):
    def always(schedules, versions):
        raise ScheduleWriteRace()

    monkeypatch.setattr(store, "save_schedules", always)
    _, job = _submit_and_run(jobs, _csv(_row()))

    assert job["status"] == "FAILED" and job["error"]["code"] == "SCHEDULE_CONFLICT"


def test_unexpected_error_fails_the_job_and_removes_its_rows(jobs, store, monkeypatch):
    job_id = jobs.submit(_csv(_row()), dry_run=False)["job_id"]
    store.schedules.append({"id": f"imp-{job_id}-2", "room_id": LAB})  # left by a crash
    other = {"id": "imp-another-job-2", "room_id": LAB}
    store.schedules.append(other)

    def boom(*a, **k):
        raise RuntimeError("bug")

    monkeypatch.setattr(store, "find_overlapping", boom)
    jobs.run_job(job_id)

    job = jobs.get_job(job_id)
    assert job["status"] == "FAILED"
    assert job["error"] == {"code": "INTERNAL_ERROR", "message": "Internal server error"}
    assert store.schedules == [other]


def test_stalled_job_is_reported_failed(jobs, store):
    job_id = jobs.submit(_csv(_row()), dry_run=False)["job_id"]
    store.jobs[job_id].update(status="PROCESSING", lease_until=NOW, attempts=3)

    assert jobs.get_job(job_id)["status"] == "PROCESSING"  # retries may still come

    jobs.clock = lambda: NOW + 331
    job = jobs.get_job(job_id)
    assert job["status"] == "FAILED" and job["error"]["code"] == "INTERNAL_ERROR"

    jobs.run_job(job_id)  # attempts used up: no further claim
    assert store.jobs[job_id]["status"] == "PROCESSING"


def test_unknown_job_is_not_found(jobs):
    with pytest.raises(ImportJobNotFound):
        jobs.get_job("nope")

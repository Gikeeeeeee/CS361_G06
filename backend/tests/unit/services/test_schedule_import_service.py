import json
from datetime import date, timedelta

import pytest

from errors import (
    CsvEmpty,
    CsvMissingColumns,
    CsvNotUtf8,
    CsvTooManyOccurrences,
    CsvTooManyRows,
    ImportConflict,
    ImportRejected,
)
from models.schedule import CSV_HEADER
from services.schedule_import_service import ScheduleImportService
from services.schedule_service import ScheduleService
from tests.conftest import FakeScheduleSource

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

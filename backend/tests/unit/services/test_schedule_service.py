import pytest

from errors import (
    MissingParameters,
    ScheduleConflict,
    ScheduleNotFound,
    ValidationError,
)
from models.schedule import (
    CONTRACT_FIELDS,
    MAX_OCCURRENCES,
    occurrences,
    overlaps,
    to_utc,
    validate,
)
from services.schedule_service import ScheduleService

ROOM = "room-uuid-1"
WEEKLY_15 = "FREQ=WEEKLY;BYDAY=WE;COUNT=15"


def _payload(**overrides):
    payload = {
        "type": "ACTIVITY",
        "title": "Club meeting",
        "start_at": "2026-09-17T09:00:00+07:00",
        "end_at": "2026-09-17T11:00:00+07:00",
        "time_zone": "Asia/Bangkok",
        "status": "CONFIRM",
    }
    payload.update(overrides)
    return payload


def _course(**overrides):
    """The v2 contract's POST example: a 15-week Wednesday lecture."""
    return _payload(
        **{
            "type": "COURSE",
            "title": "Software Engineering",
            "description": "Lecture and project coordination for CS361",
            "course_code": "CS361",
            "organizer": "Aj. Example",
            "start_at": "2026-09-16T13:00:00+07:00",
            "end_at": "2026-09-16T16:00:00+07:00",
            "recurrence_rule": WEEKLY_15,
            **overrides,
        }
    )


@pytest.fixture
def empty_source(fake_schedule_source):
    return fake_schedule_source()


# -- get ---------------------------------------------------------------------


@pytest.mark.unit
def test_get_room_schedules_matches_the_v2_contract(schedule_source):
    result = ScheduleService(schedule_source).get_room_schedules(
        ROOM, "2026-09-16T00:00:00+07:00", "2026-09-17T00:00:00+07:00", "course"
    )

    assert result["meta"] == {"room_id": ROOM, "type": "COURSE", "count": 1}
    assert list(result["data"][0]) == list(CONTRACT_FIELDS)
    assert result["data"][0]["id"] == "550e8400-e29b-41d4-a716-446655440050"
    assert result["data"][0]["recurrence_rule"] is None


@pytest.mark.unit
def test_get_room_schedules_meta_type_is_null_without_a_filter(schedule_source):
    result = ScheduleService(schedule_source).get_room_schedules(
        ROOM, "2026-10-01T00:00:00+07:00", "2026-10-02T00:00:00+07:00", ""
    )

    assert result == {"data": [], "meta": {"room_id": ROOM, "type": None, "count": 0}}


@pytest.mark.unit
def test_get_room_schedules_filters_by_type(schedule_source):
    service = ScheduleService(schedule_source)
    window = ("2026-09-16T00:00:00+07:00", "2026-09-17T00:00:00+07:00")

    assert service.get_room_schedules(ROOM, *window, "COURSE")["data"]
    assert not service.get_room_schedules(ROOM, *window, "EXAM")["data"]


@pytest.mark.unit
def test_get_room_schedules_returns_a_series_that_started_before_the_window(
    empty_source,
):
    service = ScheduleService(empty_source)
    service.create_schedule(ROOM, _course())

    # Week 6 of a series that began 2026-09-16.
    result = service.get_room_schedules(
        ROOM, "2026-10-19T00:00:00+07:00", "2026-10-26T00:00:00+07:00"
    )

    assert result["meta"]["count"] == 1
    assert result["data"][0]["start_at"] == "2026-10-21T13:00:00+07:00"
    assert result["data"][0]["end_at"] == "2026-10-21T16:00:00+07:00"
    assert result["data"][0]["recurrence_rule"] == WEEKLY_15
    assert "series_end_at" not in result["data"][0]
    assert "created_at" not in result["data"][0]


@pytest.mark.unit
def test_get_room_schedules_returns_one_row_per_occurrence(empty_source):
    service = ScheduleService(empty_source)
    service.create_schedule(ROOM, _course())

    result = service.get_room_schedules(
        ROOM, "2026-09-16T00:00:00+07:00", "2026-10-07T00:00:00+07:00"
    )

    assert [row["start_at"][:10] for row in result["data"]] == [
        "2026-09-16", "2026-09-23", "2026-09-30",
    ]
    assert len({row["id"] for row in result["data"]}) == 1
    assert result["meta"]["count"] == 3


@pytest.mark.unit
def test_get_room_schedules_skips_a_series_that_already_ended(empty_source):
    service = ScheduleService(empty_source)
    service.create_schedule(ROOM, _course())

    result = service.get_room_schedules(
        ROOM, "2027-01-01T00:00:00+07:00", "2027-02-01T00:00:00+07:00"
    )

    assert result["data"] == []


@pytest.mark.unit
def test_get_room_schedules_rejects_a_malformed_window(schedule_source):
    with pytest.raises(ValidationError):
        ScheduleService(schedule_source).get_room_schedules(
            ROOM, "last tuesday", "2026-09-17T00:00:00+07:00"
        )


# -- create ------------------------------------------------------------------


@pytest.mark.unit
def test_create_schedule_stores_a_15_week_series_as_one_item(empty_source):
    assert ScheduleService(empty_source).create_schedule(ROOM, _course()) == "created"

    [stored] = empty_source.schedules
    assert stored["room_id"] == ROOM
    assert stored["recurrence_rule"] == WEEKLY_15
    assert stored["start_at"] == "2026-09-16T13:00:00+07:00"
    # 15th Wednesday: 2026-12-23 16:00 +07:00.
    assert stored["series_end_at"] == "2026-12-23T09:00:00+00:00"
    assert stored["id"] and stored["created_at"] and stored["updated_at"]


@pytest.mark.unit
def test_create_schedule_rejects_an_overlap_with_a_confirmed_booking(
    schedule_source,
):
    # sample_schedule_raw is 2026-09-16 13:00-16:00, status=CONFIRM.
    with pytest.raises(ScheduleConflict):
        ScheduleService(schedule_source).create_schedule(
            ROOM,
            _payload(
                start_at="2026-09-16T14:00:00+07:00",
                end_at="2026-09-16T15:00:00+07:00",
            ),
        )

    assert len(schedule_source.schedules) == 1


@pytest.mark.unit
def test_create_schedule_rejects_a_clash_in_week_7_of_an_existing_series(
    empty_source,
):
    service = ScheduleService(empty_source)
    service.create_schedule(ROOM, _course())

    # One-off activity on the 7th Wednesday (2026-10-28), inside the lecture.
    with pytest.raises(ScheduleConflict, match="2026-10-28"):
        service.create_schedule(
            ROOM,
            _payload(
                type="ACTIVITY",
                start_at="2026-10-28T15:00:00+07:00",
                end_at="2026-10-28T17:00:00+07:00",
            ),
        )

    assert len(empty_source.schedules) == 1


@pytest.mark.unit
def test_create_schedule_lets_an_exam_take_over_a_lecture(empty_source):
    service = ScheduleService(empty_source)
    service.create_schedule(ROOM, _course())

    # Midterm on the 7th Wednesday, inside the lecture.
    service.create_schedule(
        ROOM,
        _payload(
            type="EXAM",
            start_at="2026-10-28T13:00:00+07:00",
            end_at="2026-10-28T16:00:00+07:00",
        ),
    )

    assert len(empty_source.schedules) == 2


@pytest.mark.unit
def test_create_schedule_rejects_a_new_series_hitting_a_later_booking(
    schedule_source,
):
    # A one-off booking on the 2nd Thursday of the new series.
    schedule_source.schedules.append(
        {
            "id": "second-week-blocker",
            "room_id": ROOM,
            "type": "COURSE",
            "status": "CONFIRM",
            "start_at": "2026-09-24T09:00:00+07:00",
            "end_at": "2026-09-24T11:00:00+07:00",
        }
    )

    with pytest.raises(ScheduleConflict, match="2026-09-24"):
        ScheduleService(schedule_source).create_schedule(
            ROOM, _payload(recurrence_rule="FREQ=WEEKLY;BYDAY=TH;COUNT=4")
        )

    assert len(schedule_source.schedules) == 2


@pytest.mark.unit
def test_create_schedule_compares_across_utc_offsets(schedule_source):
    # 06:30Z is 13:30 +07:00 -- inside the sample booking.
    with pytest.raises(ScheduleConflict):
        ScheduleService(schedule_source).create_schedule(
            ROOM,
            _payload(
                start_at="2026-09-16T06:30:00+00:00",
                end_at="2026-09-16T07:30:00+00:00",
            ),
        )


@pytest.mark.unit
def test_create_schedule_allows_back_to_back_bookings(schedule_source):
    ScheduleService(schedule_source).create_schedule(
        ROOM,
        _payload(
            start_at="2026-09-16T11:00:00+07:00",
            end_at="2026-09-16T13:00:00+07:00",
        ),
    )

    assert len(schedule_source.schedules) == 2


@pytest.mark.unit
def test_create_schedule_ignores_cancelled_schedules(schedule_source):
    schedule_source.schedules[0]["status"] = "CANCELLED"

    ScheduleService(schedule_source).create_schedule(
        ROOM,
        _payload(
            start_at="2026-09-16T13:00:00+07:00",
            end_at="2026-09-16T16:00:00+07:00",
        ),
    )

    assert len(schedule_source.schedules) == 2


@pytest.mark.unit
def test_create_schedule_allows_overlaps_in_a_different_room(schedule_source):
    ScheduleService(schedule_source).create_schedule(
        "another-room",
        _payload(
            start_at="2026-09-16T13:00:00+07:00",
            end_at="2026-09-16T16:00:00+07:00",
        ),
    )

    assert len(schedule_source.schedules) == 2


@pytest.mark.unit
@pytest.mark.parametrize(
    "missing_field", ["type", "title", "start_at", "end_at", "time_zone", "status"]
)
def test_create_schedule_rejects_missing_required_fields(
    schedule_source, missing_field
):
    payload = _payload()
    del payload[missing_field]

    with pytest.raises(MissingParameters) as exc_info:
        ScheduleService(schedule_source).create_schedule(ROOM, payload)

    assert missing_field in exc_info.value.names
    assert len(schedule_source.schedules) == 1


@pytest.mark.unit
@pytest.mark.parametrize(
    "payload",
    [
        _payload(type="PARTY"),
        _payload(status="MAYBE"),
        _payload(status="CONFIRMED"),
        _payload(title="   "),
        _payload(start_at="not a date"),
        _payload(start_at="2026-09-17T09:00:00"),  # no offset
        _payload(
            start_at="2026-09-17T11:00:00+07:00",
            end_at="2026-09-17T09:00:00+07:00",
        ),
        _payload(recurrence_rule="FREQ=DAILY"),  # infinite, no COUNT/UNTIL
        _payload(recurrence_rule="nonsense;COUNT=3"),
        _payload(recurrence_rule="FREQ=DAILY;COUNT=1000000000"),
    ],
)
def test_create_schedule_rejects_invalid_payloads(schedule_source, payload):
    with pytest.raises(ValidationError):
        ScheduleService(schedule_source).create_schedule(ROOM, payload)

    assert len(schedule_source.schedules) == 1


@pytest.mark.unit
def test_create_schedule_drops_caller_supplied_keys(schedule_source):
    """A POST cannot set its own id, keys or timestamps."""
    ScheduleService(schedule_source).create_schedule(
        ROOM,
        _payload(id="hijacked", PK="ROOM#elsewhere", created_at="1999-01-01"),
    )

    stored = schedule_source.schedules[-1]
    assert stored["id"] != "hijacked"
    assert "PK" not in stored
    assert stored["created_at"] != "1999-01-01"


# -- update ------------------------------------------------------------------


@pytest.mark.unit
def test_update_schedule_replaces_the_series(sample_schedule, fake_schedule_source):
    source = fake_schedule_source([sample_schedule])

    result = ScheduleService(source).update_schedule(
        "room-lc3-301",
        "schedule-001",
        _course(title="Advanced Software Engineering", description=None),
    )

    assert result == "updated"
    [stored] = source.schedules
    assert stored["id"] == "schedule-001"
    assert stored["title"] == "Advanced Software Engineering"
    assert stored["description"] is None  # full replace, not a merge
    assert stored["created_at"] == sample_schedule["created_at"]
    assert stored["updated_at"] != stored["created_at"]
    assert stored["series_end_at"] == "2026-12-23T09:00:00+00:00"


@pytest.mark.unit
def test_update_schedule_does_not_conflict_with_itself(
    sample_schedule, fake_schedule_source
):
    source = fake_schedule_source([sample_schedule])

    # Shift the whole Monday series by an hour: overlaps its own old slots.
    payload = _course(
        start_at="2026-09-14T10:00:00+07:00",
        end_at="2026-09-14T13:00:00+07:00",
        recurrence_rule="FREQ=WEEKLY;BYDAY=MO;COUNT=15",
    )

    assert ScheduleService(source).update_schedule(
        "room-lc3-301", "schedule-001", payload
    ) == "updated"


@pytest.mark.unit
def test_update_schedule_rejects_a_conflict_with_another_series(
    sample_schedule, fake_schedule_source
):
    source = fake_schedule_source([sample_schedule])
    service = ScheduleService(source)
    service.create_schedule("room-lc3-301", _course())  # Wednesdays
    wednesday_id = source.schedules[-1]["id"]

    # Move the Wednesday series onto the Monday lecture.
    with pytest.raises(ScheduleConflict):
        service.update_schedule(
            "room-lc3-301",
            wednesday_id,
            _course(
                start_at="2026-09-21T10:00:00+07:00",
                end_at="2026-09-21T11:00:00+07:00",
                recurrence_rule="FREQ=WEEKLY;BYDAY=MO;COUNT=3",
            ),
        )


@pytest.mark.unit
def test_update_schedule_not_found(fake_schedule_source):
    source = fake_schedule_source()

    with pytest.raises(ScheduleNotFound):
        ScheduleService(source).update_schedule(
            "room-lc3-301", "schedule-999", _course()
        )

    assert source.schedules == []


@pytest.mark.unit
@pytest.mark.parametrize(
    "payload",
    [
        {"type": "COURSE", "title": "Missing the rest"},
        _course(type="INVALID_TYPE"),
        _course(recurrence_rule="FREQ=WEEKLY;BYDAY=WE"),  # infinite
    ],
)
def test_update_schedule_rejects_invalid_payloads(
    sample_schedule, fake_schedule_source, payload
):
    source = fake_schedule_source([sample_schedule])

    with pytest.raises(ValidationError):
        ScheduleService(source).update_schedule(
            "room-lc3-301", "schedule-001", payload
        )

    assert source.schedules == [sample_schedule]


# -- delete ------------------------------------------------------------------


@pytest.mark.unit
def test_delete_existing_schedule(sample_schedule, fake_schedule_source):
    source = fake_schedule_source([sample_schedule])

    assert ScheduleService(source).delete_schedule(
        "room-lc3-301", "schedule-001"
    ) == "deleted"
    assert source.deleted_schedule == ("room-lc3-301", "schedule-001")


@pytest.mark.unit
def test_delete_schedule_not_found(fake_schedule_source):
    source = fake_schedule_source()

    with pytest.raises(ScheduleNotFound):
        ScheduleService(source).delete_schedule("room-lc3-301", "schedule-999")

    assert source.deleted_schedule is None


# -- domain helpers ----------------------------------------------------------


@pytest.mark.unit
def test_overlaps_is_half_open():
    from datetime import datetime as dt

    a, b, c, d = (dt(2026, 1, 1, h) for h in (9, 10, 11, 12))

    assert overlaps(a, c, b, d)  # partial
    assert overlaps(a, d, b, c)  # contained
    assert not overlaps(a, b, b, c)  # touching
    assert not overlaps(a, b, c, d)  # disjoint


@pytest.mark.unit
def test_occurrences_without_a_rule_is_the_slot_itself():
    [(start, end)] = occurrences(
        "2026-09-17T09:00:00+07:00", "2026-09-17T11:00:00+07:00"
    )

    assert start.isoformat() == "2026-09-17T09:00:00+07:00"
    assert end.isoformat() == "2026-09-17T11:00:00+07:00"


@pytest.mark.unit
def test_occurrences_stops_at_the_limit():
    with pytest.raises(ValidationError, match=str(MAX_OCCURRENCES)):
        occurrences(
            "2026-09-17T09:00:00+07:00",
            "2026-09-17T11:00:00+07:00",
            f"FREQ=DAILY;COUNT={MAX_OCCURRENCES + 1}",
        )


@pytest.mark.unit
def test_to_utc_is_sortable_across_offsets():
    assert to_utc("2026-09-16T13:00:00+07:00") == "2026-09-16T06:00:00+00:00"
    assert to_utc("2026-09-16T06:00:00.500000+00:00") == "2026-09-16T06:00:00+00:00"


@pytest.mark.unit
def test_validate_accepts_the_v2_contract_example():
    schedule = validate(_course())

    assert schedule["recurrence_rule"] == WEEKLY_15
    assert schedule["organizer"] == "Aj. Example"

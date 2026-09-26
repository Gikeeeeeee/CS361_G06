import pytest

from errors import (
    InvalidSchedule,
    MissingParameters,
    ScheduleConflict,
    ScheduleNotFound,
    ValidationError,
)
from models.schedule import MAX_OCCURRENCES, occurrences, overlaps
from services.schedule_service import ScheduleService


class TestUpdateSchedule:

    def test_update_existing_schedule(
        self,
        sample_schedule,
        fake_schedule_source,
    ):
        source = fake_schedule_source({
            ("room-lc3-301", "schedule-001"): sample_schedule
        })

        service = ScheduleService(source)

        payload = {
            "type": "COURSE",
            "title": "Updated CS361",
            "description": "Updated lecture",
            "course_code": "CS361",
            "organizer": "Computer Science Department",
            "start_at": "2026-09-14T10:00:00+07:00",
            "end_at": "2026-09-14T12:00:00+07:00",
            "time_zone": "Asia/Bangkok",
            "recurrence_rule": (
                "RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=15"
            ),
            "status": "CONFIRMED",
        }

        result = service.update_schedule(
            "room-lc3-301",
            "schedule-001",
            payload,
        )

        assert result["id"] == "schedule-001"
        assert result["room_id"] == "room-lc3-301"
        assert result["title"] == "Updated CS361"

        assert source.updated_schedule is not None
        assert source.updated_schedule["title"] == "Updated CS361"

    def test_update_schedule_not_found(
        self,
        fake_schedule_source,
    ):
        source = fake_schedule_source()

        service = ScheduleService(source)

        payload = {
            "type": "COURSE",
            "title": "Updated CS361",
        }

        with pytest.raises(ScheduleNotFound):
            service.update_schedule(
                "room-lc3-301",
                "schedule-999",
                payload,
            )

        assert source.updated_schedule is None

    def test_update_schedule_invalid_payload(
        self,
        sample_schedule,
        fake_schedule_source,
    ):
        source = fake_schedule_source({
            ("room-lc3-301", "schedule-001"): sample_schedule
        })

        service = ScheduleService(source)

        invalid_payload = {
            "type": "INVALID_TYPE",
            "title": "Invalid Schedule",
        }

        with pytest.raises(InvalidSchedule):
            service.update_schedule(
                "room-lc3-301",
                "schedule-001",
                invalid_payload,
            )

        assert source.updated_schedule is None


class TestDeleteSchedule:

    def test_delete_existing_schedule(
        self,
        sample_schedule,
        fake_schedule_source,
    ):
        source = fake_schedule_source({
            ("room-lc3-301", "schedule-001"): sample_schedule
        })

        service = ScheduleService(source)

        result = service.delete_schedule(
            "room-lc3-301",
            "schedule-001",
        )

        assert result == "deleted"

        assert source.deleted_schedule == (
            "room-lc3-301",
            "schedule-001",
        )

    def test_delete_schedule_not_found(
        self,
        fake_schedule_source,
    ):
        source = fake_schedule_source()

        service = ScheduleService(source)

        with pytest.raises(ScheduleNotFound):
            service.delete_schedule(
                "room-lc3-301",
                "schedule-999",
            )

        assert source.deleted_schedule is None


ROOM = "room-uuid-1"


def _payload(**overrides):
    payload = {
        "type": "ACTIVITY",
        "title": "Club meeting",
        "start_at": "2026-09-17T09:00:00+07:00",
        "end_at": "2026-09-17T11:00:00+07:00",
    }
    payload.update(overrides)
    return payload


# -- get ---------------------------------------------------------------------


@pytest.mark.unit
def test_get_room_schedules_returns_schedules_in_window(schedule_source):
    service = ScheduleService(schedule_source)

    result = service.get_room_schedules(
        ROOM, "2026-09-16T00:00:00+07:00", "2026-09-17T00:00:00+07:00"
    )

    assert [s["id"] for s in result["schedules"]] == [
        "550e8400-e29b-41d4-a716-446655440050"
    ]


@pytest.mark.unit
def test_get_room_schedules_outside_window_is_empty(schedule_source):
    service = ScheduleService(schedule_source)

    result = service.get_room_schedules(
        ROOM, "2026-10-01T00:00:00+07:00", "2026-10-02T00:00:00+07:00"
    )

    assert result == {"schedules": []}


@pytest.mark.unit
def test_get_room_schedules_filters_by_type(schedule_source):
    service = ScheduleService(schedule_source)
    window = ("2026-09-16T00:00:00+07:00", "2026-09-17T00:00:00+07:00")

    assert service.get_room_schedules(ROOM, *window, "COURSE")["schedules"]
    assert not service.get_room_schedules(ROOM, *window, "EXAM")["schedules"]


@pytest.mark.unit
def test_get_room_schedules_rejects_a_malformed_window(schedule_source):
    service = ScheduleService(schedule_source)

    with pytest.raises(ValidationError):
        service.get_room_schedules(ROOM, "last tuesday", "2026-09-17T00:00:00+07:00")


# -- create ------------------------------------------------------------------


@pytest.mark.unit
def test_create_schedule_stores_one_item(schedule_source):
    service = ScheduleService(schedule_source)

    assert service.create_schedule(ROOM, _payload()) == "created"

    stored = schedule_source.schedules[-1]
    assert stored["room_id"] == ROOM
    assert stored["status"] == "CONFIRM"
    assert stored["id"] and stored["created_at"] and stored["updated_at"]


@pytest.mark.unit
def test_create_schedule_expands_a_recurrence_rule(schedule_source):
    service = ScheduleService(schedule_source)

    service.create_schedule(
        ROOM, _payload(recurrence_rule="FREQ=WEEKLY;BYDAY=TH;COUNT=15")
    )

    created = schedule_source.schedules[1:]
    assert len(created) == 15
    assert created[0]["start_at"] == "2026-09-17T09:00:00+07:00"
    assert created[-1]["start_at"] == "2026-12-24T09:00:00+07:00"
    # Every occurrence keeps the length of the first, and gets its own id.
    assert created[-1]["end_at"] == "2026-12-24T11:00:00+07:00"
    assert len({s["id"] for s in created}) == 15


@pytest.mark.unit
def test_create_schedule_rejects_an_overlap_with_a_confirmed_booking(
    schedule_source,
):
    service = ScheduleService(schedule_source)

    # sample_schedule is 2026-09-16 13:00-16:00, status=CONFIRM.
    with pytest.raises(ScheduleConflict):
        service.create_schedule(
            ROOM,
            _payload(
                start_at="2026-09-16T14:00:00+07:00",
                end_at="2026-09-16T15:00:00+07:00",
            ),
        )

    # Nothing written when the check fails.
    assert len(schedule_source.schedules) == 1


@pytest.mark.unit
def test_create_schedule_rejects_an_overlap_late_in_the_recurrence(
    schedule_source,
):
    # Second week overlaps with an existing booking in the same room.
    overlap_date = "2026-09-24"
    schedule_source.schedules.append(
        {
            "id": "second-week-blocker",
            "room_id": ROOM,
            "type": "COURSE",
            "status": "CONFIRM",
            "start_at": f"{overlap_date}T09:00:00+07:00",
            "end_at": f"{overlap_date}T11:00:00+07:00",
        }
    )

    service = ScheduleService(schedule_source)

    with pytest.raises(ScheduleConflict) as exc_info:
        service.create_schedule(
            ROOM, _payload(recurrence_rule="FREQ=WEEKLY;BYDAY=TH;COUNT=4")
        )

    assert overlap_date in exc_info.value.message
    # Atomicity: none of the 4 occurrences were written.
    assert len(schedule_source.schedules) == 2


@pytest.mark.unit
def test_create_schedule_allows_back_to_back_bookings(schedule_source):
    service = ScheduleService(schedule_source)

    # Exactly touches the sample booking (ends at 13:00, sample starts at 13:00).
    service.create_schedule(
        ROOM,
        _payload(
            start_at="2026-09-16T11:00:00+07:00",
            end_at="2026-09-16T13:00:00+07:00",
        ),
    )

    assert len(schedule_source.schedules) == 2


@pytest.mark.unit
def test_create_schedule_ignores_cancelled_and_tentative_schedules(
    schedule_source,
):
    schedule_source.schedules[0]["status"] = "CANCELLED"

    service = ScheduleService(schedule_source)

    # Exactly overlaps the cancelled booking -- should succeed.
    service.create_schedule(
        ROOM,
        _payload(
            start_at="2026-09-16T13:00:00+07:00",
            end_at="2026-09-16T16:00:00+07:00",
        ),
    )

    assert len(schedule_source.schedules) == 2


@pytest.mark.unit
def test_create_schedule_allows_overlaps_in_a_different_room(schedule_source):
    service = ScheduleService(schedule_source)

    # Same time as the sample, different room.
    service.create_schedule(
        "another-room",
        _payload(
            start_at="2026-09-16T13:00:00+07:00",
            end_at="2026-09-16T16:00:00+07:00",
        ),
    )

    assert len(schedule_source.schedules) == 2


@pytest.mark.unit
@pytest.mark.parametrize("missing_field", ["type", "title", "start_at", "end_at"])
def test_create_schedule_rejects_missing_required_fields(
    schedule_source, missing_field
):
    service = ScheduleService(schedule_source)
    payload = _payload()
    del payload[missing_field]

    with pytest.raises(MissingParameters) as exc_info:
        service.create_schedule(ROOM, payload)

    assert missing_field in exc_info.value.names
    assert len(schedule_source.schedules) == 1


@pytest.mark.unit
@pytest.mark.parametrize(
    "payload",
    [
        _payload(type="PARTY"),
        _payload(status="MAYBE"),
        _payload(start_at="not a date"),
        _payload(
            start_at="2026-09-17T11:00:00+07:00",
            end_at="2026-09-17T09:00:00+07:00",
        ),
        _payload(recurrence_rule="FREQ=DAILY"),  # infinite, no COUNT/UNTIL
        _payload(recurrence_rule="nonsense"),
    ],
)
def test_create_schedule_rejects_invalid_payloads(schedule_source, payload):
    service = ScheduleService(schedule_source)

    with pytest.raises(ValidationError):
        service.create_schedule(ROOM, payload)

    assert len(schedule_source.schedules) == 1


@pytest.mark.unit
def test_create_schedule_drops_caller_supplied_keys(schedule_source):
    """A POST cannot set its own id or timestamps."""
    service = ScheduleService(schedule_source)

    service.create_schedule(
        ROOM, _payload(id="hijacked", PK="ROOM#somewhere-else")
    )

    stored = schedule_source.schedules[-1]
    assert stored["id"] != "hijacked"
    assert "PK" not in stored


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
    slot = ("2026-09-17T09:00:00+07:00", "2026-09-17T11:00:00+07:00")

    assert occurrences(*slot) == [slot]
    assert occurrences(*slot, None) == [slot]


@pytest.mark.unit
def test_occurrences_stops_at_the_write_limit():
    with pytest.raises(ValidationError, match=str(MAX_OCCURRENCES)):
        occurrences(
            "2026-09-17T09:00:00+07:00",
            "2026-09-17T11:00:00+07:00",
            f"FREQ=DAILY;COUNT={MAX_OCCURRENCES + 1}",
        )

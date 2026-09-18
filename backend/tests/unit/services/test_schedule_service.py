import pytest

from errors import InvalidSchedule, ScheduleNotFound
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

        assert result is None

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
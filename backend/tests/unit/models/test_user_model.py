from datetime import datetime, timezone
import pytest

from models.user import User, format_iso_utc


@pytest.mark.unit
def test_format_iso_utc():
    assert format_iso_utc(None) is None
    assert format_iso_utc("") is None

    # String with space
    assert format_iso_utc("2026-10-14 15:27:00+00:00") == "2026-10-14T15:27:00Z"
    assert format_iso_utc("2026-10-14 15:27:00+00") == "2026-10-14T15:27:00Z"

    # Datetime object
    dt = datetime(2026, 10, 14, 15, 27, 0, tzinfo=timezone.utc)
    assert format_iso_utc(dt) == "2026-10-14T15:27:00Z"


@pytest.mark.unit
def test_user_from_record_and_to_dict():
    record = {
        "id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
        "email": "student@dome.tu.ac.th",
        "full_name": "Tatchakrit Starrat",
        "role": "STUDENT",
        "created_at": "2026-10-14 15:27:00+00",
        "last_login": "2026-10-14 15:27:00+00",
    }
    user = User.from_record(record)

    assert user.id == "a1b2c3d4-e5f6-7890-1234-56789abcdef0"
    assert user.email == "student@dome.tu.ac.th"
    assert user.full_name == "Tatchakrit Starrat"
    assert user.role == "STUDENT"

    data = user.to_dict()
    assert data == {
        "id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
        "email": "student@dome.tu.ac.th",
        "full_name": "Tatchakrit Starrat",
        "role": "STUDENT",
        "created_at": "2026-10-14T15:27:00Z",
        "last_login": "2026-10-14T15:27:00Z",
    }

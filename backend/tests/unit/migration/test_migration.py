import pytest

from migration.mapper import map_room
from migration.migrate import build_plan


def fixture_building(room_number="101"):
    return {"id": "b1", "code": "LC3", "name": {"en": "LC3"}, "floors": [{
        "id": "f1", "floor_number": 1, "facilities": [{"id": "fac1", "type": "STAIR", "name": {"en": "West Stair"}}], "rooms": [{
            "id": "r1", "room_number": room_number, "type": "CLASSROOM",
            "name": {"en": "Room 101"}, "facilities": {"projector": True, "wifi": False},
        }],
    }]}


def test_build_plan_preserves_ids_and_uses_existing_keys():
    items, counts, errors = build_plan([fixture_building()])
    room = next(item for item in items if item.get("GSI0PK") == "ROOM")
    assert room["id"] == "r1"
    assert (room["PK"], room["SK"]) == ("FLOOR#f1", "ROOM#101")
    assert counts == {"buildings": 1, "floors": 1, "rooms": 1, "facilities": 1, "schedules": 0}
    assert errors == []


def test_missing_room_number_uses_stable_id_for_storage_key():
    items, _, errors = build_plan([fixture_building(None)])
    room = next(item for item in items if item.get("GSI0PK") == "ROOM")
    assert room["room_number"] is None
    assert room["SK"] == "ROOM#R1"
    assert errors == []


def test_orphan_schedule_is_validation_error():
    _, _, errors = build_plan([fixture_building()], [{
        "id": "s1", "room_id": "missing", "type": "COURSE", "start_at": "2030-01-01T00:00:00+00:00"
    }])
    assert "references missing room" in errors[0]

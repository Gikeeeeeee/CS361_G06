import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import pytest

from errors import BuildingNotFound, FloorNotFound, RoomNotFound
from services.room_service import RoomService


class FakeRoomSource:
    def __init__(
        self,
        room=None,
        floor=None,
        building=None,
    ):
        self.room = room
        self.floor = floor
        self.building = building
        self.calls = []

    def get_room(self, room_id):
        self.calls.append(("get_room", room_id))
        if self.room and str(self.room.get("id")) == str(room_id):
            return self.room
        return None

    def get_floor(self, floor_id):
        self.calls.append(("get_floor", floor_id))
        if self.floor and str(self.floor.get("id")) == str(floor_id):
            return self.floor
        return None

    def get_building(self, building_id):
        self.calls.append(("get_building", building_id))
        if self.building and str(self.building.get("id")) == str(
            building_id
        ):
            return self.building
        return None


@pytest.fixture
def room():
    return {
        "id": "room-001",
        "room_number": "101",
        "name": {"th": "ห้อง 101", "en": "Room 101"},
        "type": "CLASSROOM",
        "floor_id": "floor-001",
        "building_id": "building-001",
        "facilities": {"projector": True, "wifi": True},
        "schedule": {},
        "event": {},
        "image_url": None,
        "latitude": 14.07269,
        "longitude": 100.60614,
    }


@pytest.fixture
def floor():
    return {
        "id": "floor-001",
        "floor_number": 1,
        "building_id": "building-001",
        "floor_plan": {},
    }


@pytest.fixture
def building():
    return {
        "id": "building-001",
        "code": "LC3",
        "name": {
            "th": "อาคารบรรยายรวม 3",
            "en": "Lecture Classroom 3",
        },
    }


def make_service(room=None, floor=None, building=None):
    source = FakeRoomSource(
        room=room,
        floor=floor,
        building=building,
    )
    return RoomService(source), source


# Positive cases


def test_get_room_by_id_success(room, floor, building):
    service, _ = make_service(room, floor, building)

    result = service.get_room("room-001")

    assert result["id"] == "room-001"
    assert result["room_number"] == "101"
    assert result["name"] == {"th": "ห้อง 101", "en": "Room 101"}
    assert result["type"] == "CLASSROOM"
    assert result["facilities"] == {"projector": True, "wifi": True}
    assert result["schedule"] == {}
    assert result["event"] == {}
    assert result["image_url"] is None
    assert result["latitude"] == 14.07269
    assert result["longitude"] == 100.60614

    assert result["building"] == {
        "id": "building-001",
        "code": "LC3",
        "name": {
            "th": "อาคารบรรยายรวม 3",
            "en": "Lecture Classroom 3",
        },
    }
    assert result["floor"] == {
        "id": "floor-001",
        "floor_number": 1,
    }
    assert result["floor_plan"] == {}


def test_get_room_calls_source_in_expected_order(room, floor, building):
    service, source = make_service(room, floor, building)

    service.get_room("room-001")

    assert source.calls == [
        ("get_room", "room-001"),
        ("get_floor", "floor-001"),
        ("get_building", "building-001"),
    ]


def test_get_room_uses_default_optional_fields(floor, building):
    room = {
        "id": "room-002",
        "room_number": "102",
        "floor_id": "floor-001",
        "building_id": "building-001",
    }
    service, _ = make_service(room, floor, building)

    result = service.get_room("room-002")

    assert result["facilities"] == {}
    assert result["schedule"] == {}
    assert result["event"] == {}
    assert result["image_url"] is None
    assert result["latitude"] is None
    assert result["longitude"] is None
    assert result["floor_plan"] == {}


def test_get_room_uses_floor_building_id_when_room_has_no_building_id(
    floor, building
):
    room = {
        "id": "room-003",
        "room_number": "103",
        "floor_id": "floor-001",
    }
    service, source = make_service(room, floor, building)

    result = service.get_room("room-003")

    assert result["building"]["id"] == "building-001"
    assert ("get_building", "building-001") in source.calls


def test_get_room_with_empty_optional_objects(floor, building):
    room = {
        "id": "room-004",
        "room_number": "104",
        "floor_id": "floor-001",
        "building_id": "building-001",
        "facilities": {},
        "schedule": {},
        "event": {},
    }
    service, _ = make_service(room, floor, building)

    result = service.get_room("room-004")

    assert result["facilities"] == {}
    assert result["schedule"] == {}
    assert result["event"] == {}


# Negative cases


def test_get_room_not_found():
    service, source = make_service()

    with pytest.raises(RoomNotFound) as error:
        service.get_room("room-999")

    assert error.value.status_code == 404
    assert error.value.code == "ROOM_NOT_FOUND"
    assert source.calls == [("get_room", "room-999")]


def test_get_room_floor_not_found(room, building):
    service, source = make_service(room, None, building)

    with pytest.raises(FloorNotFound) as error:
        service.get_room("room-001")

    assert error.value.status_code == 404
    assert source.calls == [
        ("get_room", "room-001"),
        ("get_floor", "floor-001"),
    ]


def test_get_room_building_not_found(room, floor):
    service, source = make_service(room, floor, None)

    with pytest.raises(BuildingNotFound) as error:
        service.get_room("room-001")

    assert error.value.status_code == 404
    assert source.calls == [
        ("get_room", "room-001"),
        ("get_floor", "floor-001"),
        ("get_building", "building-001"),
    ]


def test_get_room_missing_floor_id_raises_floor_not_found(
    building,
):
    room = {
        "id": "room-005",
        "room_number": "105",
        "building_id": "building-001",
    }
    service, source = make_service(room, None, building)

    with pytest.raises(FloorNotFound):
        service.get_room("room-005")

    assert source.calls == [
        ("get_room", "room-005"),
    ]


def test_get_room_missing_building_id_raises_building_not_found(
    room, floor
):
    room_without_building = {
        key: value
        for key, value in room.items()
        if key != "building_id"
    }
    floor_without_building = {
        key: value
        for key, value in floor.items()
        if key != "building_id"
    }
    service, source = make_service(
        room_without_building,
        floor_without_building,
        None,
    )

    with pytest.raises(BuildingNotFound):
        service.get_room("room-001")

    assert source.calls == [
        ("get_room", "room-001"),
        ("get_floor", "floor-001"),
    ]

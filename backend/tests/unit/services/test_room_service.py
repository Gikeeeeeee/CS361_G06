import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import pytest
from errors import RoomNotFound
from services.room_service import RoomService


class FakeBuildingSource:
    def __init__(self, buildings, data):
        self.buildings = buildings
        self.data = data

    def list_buildings(self):
        return self.buildings

    def get_building(self, building_id):
        return self.data.get(building_id)


def make_service(data, buildings=None):
    buildings = buildings or [{"id": "building-001"}]
    return RoomService(FakeBuildingSource(buildings, data))


# ==================== Positive ====================

def test_get_room_by_id():
    service = make_service({
        "building-001": {
            "id": "building-001",
            "code": "LC3",
            "floors": [{
                "id": "floor-001",
                "floor_number": 1,
                "rooms": [{
                    "id": "room-001",
                    "room_number": "101",
                    "name": {"en": "Faculty Office"},
                    "type": "OFFICE",
                    "facilities": {"wifi": True},
                }]
            }]
        }
    })

    result = service.get_room("room-001")

    assert result["id"] == "room-001"
    assert result["room_number"] == "101"
    assert result["type"] == "OFFICE"
    assert result["facilities"]["wifi"] is True
    assert result["building"]["code"] == "LC3"
    assert result["floor"]["floor_number"] == 1


def test_get_room_by_room_number():
    service = make_service({
        "building-001": {
            "id": "building-001",
            "floors": [{
                "rooms": [{"id": "room-001", "room_number": "101"}]
            }]
        }
    })

    result = service.get_room("101")

    assert result["id"] == "room-001"


def test_get_room_in_second_building():
    service = make_service(
        {
            "building-001": {"id": "building-001", "floors": []},
            "building-002": {
                "id": "building-002",
                "code": "LC4",
                "floors": [{
                    "id": "floor-002",
                    "floor_number": 2,
                    "rooms": [{"id": "room-002", "room_number": "201"}]
                }]
            },
        },
        [{"id": "building-001"}, {"id": "building-002"}],
    )

    result = service.get_room("room-002")

    assert result["id"] == "room-002"
    assert result["building"]["code"] == "LC4"
    assert result["floor"]["floor_number"] == 2


def test_get_room_uses_defaults():
    service = make_service({
        "building-001": {
            "id": "building-001",
            "floors": [{
                "rooms": [{"id": "room-001", "room_number": "101"}]
            }]
        }
    })

    result = service.get_room("room-001")

    assert result["facilities"] == {}
    assert result["schedule"] == {}
    assert result["event"] == {}
    assert result["floor_plan"] == {}


# ==================== Negative ====================

def test_get_room_not_found():
    service = make_service({
        "building-001": {
            "id": "building-001",
            "floors": [{
                "rooms": [{"id": "room-001"}]
            }]
        }
    })

    with pytest.raises(RoomNotFound) as error:
        service.get_room("room-999")

    assert error.value.status_code == 404
    assert error.value.code == "ROOM_NOT_FOUND"


def test_skip_building_without_id():
    service = make_service({}, [{"code": "LC3"}])

    with pytest.raises(RoomNotFound):
        service.get_room("room-001")


def test_skip_missing_building_data():
    service = make_service({})

    with pytest.raises(RoomNotFound):
        service.get_room("room-001")


def test_building_without_floors():
    service = make_service({
        "building-001": {
            "id": "building-001",
            "floors": []
        }
    })

    with pytest.raises(RoomNotFound):
        service.get_room("room-001")


def test_floor_without_rooms():
    service = make_service({
        "building-001": {
            "id": "building-001",
            "floors": [{"rooms": []}]
        }
    })

    with pytest.raises(RoomNotFound):
        service.get_room("room-001")
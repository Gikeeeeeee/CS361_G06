import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import pytest

from errors import BuildingNotFound, FacilityNotFound, FloorNotFound
from services.facility_service import FacilityService


class FakeFacilitySource:
    def __init__(
        self,
        facility=None,
        floor=None,
        building=None,
    ):
        self.facility = facility
        self.floor = floor
        self.building = building
        self.calls = []

    def get_facility(self, facility_id):
        self.calls.append(("get_facility", facility_id))
        if self.facility and str(self.facility.get("id")) == str(
            facility_id
        ):
            return self.facility
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
def facility():
    return {
        "id": "facility-001",
        "name": {"th": "ลิฟต์", "en": "Elevator"},
        "description": {
            "th": "ลิฟต์สำหรับให้บริการภายในอาคาร",
            "en": "Elevator serving the building",
        },
        "type": "ELEVATOR",
        "floor_id": "floor-001",
        "building_id": "building-001",
        "latitude": 14.0726,
        "longitude": 100.6061,
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


def make_service(facility=None, floor=None, building=None):
    source = FakeFacilitySource(
        facility=facility,
        floor=floor,
        building=building,
    )
    return FacilityService(source), source


# Positive cases


def test_get_facility_success(facility, floor, building):
    service, _ = make_service(facility, floor, building)

    result = service.get_facility("facility-001")

    assert result == {
        "id": "facility-001",
        "name": {"th": "ลิฟต์", "en": "Elevator"},
        "description": {
            "th": "ลิฟต์สำหรับให้บริการภายในอาคาร",
            "en": "Elevator serving the building",
        },
        "type": "ELEVATOR",
        "latitude": 14.0726,
        "longitude": 100.6061,
        "building": {
            "id": "building-001",
            "code": "LC3",
            "name": {
                "th": "อาคารบรรยายรวม 3",
                "en": "Lecture Classroom 3",
            },
        },
        "floor": {
            "id": "floor-001",
            "floor_number": 1,
        },
        "floor_plan": {},
    }


def test_get_facility_calls_source_in_expected_order(
    facility, floor, building
):
    service, source = make_service(facility, floor, building)

    service.get_facility("facility-001")

    assert source.calls == [
        ("get_facility", "facility-001"),
        ("get_floor", "floor-001"),
        ("get_building", "building-001"),
    ]


def test_get_facility_on_second_floor(building):
    facility = {
        "id": "facility-002",
        "name": {"en": "Elevator"},
        "type": "ELEVATOR",
        "floor_id": "floor-002",
        "building_id": "building-001",
    }
    floor = {
        "id": "floor-002",
        "floor_number": 2,
        "building_id": "building-001",
        "floor_plan": {"type": "svg"},
    }
    service, _ = make_service(facility, floor, building)

    result = service.get_facility("facility-002")

    assert result["id"] == "facility-002"
    assert result["floor"] == {
        "id": "floor-002",
        "floor_number": 2,
    }
    assert result["floor_plan"] == {"type": "svg"}


def test_get_facility_in_second_building(facility, floor):
    facility = {**facility, "building_id": "building-002"}
    floor = {**floor, "building_id": "building-002"}
    building = {
        "id": "building-002",
        "code": "LC4",
        "name": {"en": "Lecture Classroom 4"},
    }
    service, _ = make_service(facility, floor, building)

    result = service.get_facility("facility-001")

    assert result["building"]["id"] == "building-002"
    assert result["building"]["code"] == "LC4"


def test_get_facility_defaults_missing_fields(floor, building):
    facility = {
        "id": "facility-003",
        "floor_id": "floor-001",
        "building_id": "building-001",
    }
    service, _ = make_service(facility, floor, building)

    result = service.get_facility("facility-003")

    assert result["name"] is None
    assert result["description"] is None
    assert result["type"] is None
    assert result["latitude"] is None
    assert result["longitude"] is None
    assert result["floor_plan"] == {}


# Negative cases


def test_get_facility_not_found():
    service, source = make_service()

    with pytest.raises(FacilityNotFound) as error:
        service.get_facility("facility-999")

    assert error.value.status_code == 404
    assert error.value.code == "FACILITY_NOT_FOUND"
    assert source.calls == [("get_facility", "facility-999")]


def test_get_facility_floor_not_found(facility, building):
    service, source = make_service(facility, None, building)

    with pytest.raises(FloorNotFound) as error:
        service.get_facility("facility-001")

    assert error.value.status_code == 404
    assert source.calls == [
        ("get_facility", "facility-001"),
        ("get_floor", "floor-001"),
    ]


def test_get_facility_building_not_found(facility, floor):
    service, source = make_service(facility, floor, None)

    with pytest.raises(BuildingNotFound) as error:
        service.get_facility("facility-001")

    assert error.value.status_code == 404
    assert source.calls == [
        ("get_facility", "facility-001"),
        ("get_floor", "floor-001"),
        ("get_building", "building-001"),
    ]


def test_get_facility_missing_floor_id(building):
    facility = {
        "id": "facility-004",
        "building_id": "building-001",
    }
    service, source = make_service(facility, None, building)

    with pytest.raises(FloorNotFound):
        service.get_facility("facility-004")

    assert source.calls == [
        ("get_facility", "facility-004"),
    ]


def test_get_facility_missing_building_id(facility, floor):
    facility_without_building = {
        key: value
        for key, value in facility.items()
        if key != "building_id"
    }
    service, source = make_service(
        facility_without_building,
        floor,
        None,
    )

    with pytest.raises(BuildingNotFound):
        service.get_facility("facility-001")

    assert source.calls == [
        ("get_facility", "facility-001"),
        ("get_floor", "floor-001"),
    ]
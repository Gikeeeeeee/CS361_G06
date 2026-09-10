import sys

from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import pytest

from errors import FacilityNotFound
from services.facility_service import FacilityService


class FakeBuildingSource:

    def __init__(self, buildings, data):
        self.buildings = buildings
        self.data = data

    def list_buildings(self):
        return self.buildings

    def get_building(self, building_code):
        return self.data.get(building_code)

    def presigned_url(self, key, expires_in=3600):
        return f"https://example.com/{key}"


def make_service(data, buildings=None):

    if buildings is None:
        buildings = [{"code": "LC3"}]

    return FacilityService(
        FakeBuildingSource(buildings, data)
    )


# TC01 - Get Facility Successfully
def test_get_facility():

    service = make_service({

        "LC3": {
            "id": "building-001",
            "code": "LC3",
            "name": {
                "th": "อาคารบรรยายรวม 3",
                "en": "Lecture Classroom 3",
            },
            "floors": [
                {
                    "id": "floor-001",
                    "floor_number": 1,
                    "floor_plan_key": "floor-plan/LC3/LC3-floor1.svg",
                    "facilities": [
                        {
                            "id": "facility-001",
                            "name": {
                                "th": "ลิฟต์",
                                "en": "Elevator",
                            },
                            "description": {
                                "th": "ลิฟต์สำหรับให้บริการภายในอาคาร",
                                "en": "Elevator serving the building",
                            },
                            "type": "ELEVATOR",
                            "latitude": 14.0726,
                            "longitude": 100.6061,
                        }
                    ],
                }
            ],
        }

    })

    result = service.get_facility("facility-001")

    assert result == {
        "id": "facility-001",

        "name": {
            "th": "ลิฟต์",
            "en": "Elevator",
        },

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

        "floor_plan": {
            "type": "svg",
            "url": "https://example.com/floor-plan/LC3/LC3-floor1.svg",
        },
    }


# TC02 - Facility Not Found
def test_get_facility_not_found():

    service = make_service({

        "LC3": {
            "id": "building-001",
            "code": "LC3",
            "floors": [
                {
                    "id": "floor-001",
                    "floor_number": 1,
                    "floor_plan_key": "floor-plan/LC3/LC3-floor1.svg",
                    "facilities": [],
                }
            ],
        }

    })

    with pytest.raises(FacilityNotFound) as error:
        service.get_facility("facility-999")

    assert error.value.status_code == 404
    assert error.value.code == "FACILITY_NOT_FOUND"


# TC03 - Find Facility in Second Floor
def test_get_facility_in_second_floor():

    service = make_service({

        "LC3": {
            "id": "building-001",
            "code": "LC3",
            "name": {
                "th": "อาคารบรรยายรวม 3",
                "en": "Lecture Classroom 3",
            },
            "floors": [

                {
                    "id": "floor-001",
                    "floor_number": 1,
                    "floor_plan_key": "floor-plan/LC3/LC3-floor1.svg",
                    "facilities": [],
                },

                {
                    "id": "floor-002",
                    "floor_number": 2,
                    "floor_plan_key": "floor-plan/LC3/LC3-floor2.svg",
                    "facilities": [
                        {
                            "id": "facility-002",
                            "name": {
                                "th": "ลิฟต์",
                                "en": "Elevator",
                            },
                            "description": {
                                "th": "ลิฟต์สำหรับให้บริการภายในอาคาร",
                                "en": "Elevator serving the building",
                            },
                            "type": "ELEVATOR",
                            "latitude": 14.0726,
                            "longitude": 100.6061,
                        }
                    ],
                }

            ],
        }

    })

    result = service.get_facility("facility-002")

    assert result["id"] == "facility-002"
    assert result["floor"]["id"] == "floor-002"
    assert result["floor"]["floor_number"] == 2
    assert result["floor_plan"]["type"] == "svg"
    assert result["floor_plan"]["url"] == (
        "https://example.com/floor-plan/LC3/LC3-floor2.svg"
    )


# TC04 - Find Facility in Second Building
def test_get_facility_in_second_building():

    service = make_service(

        {
            "LC3": {
                "id": "building-001",
                "code": "LC3",
                "name": {
                    "th": "อาคารบรรยายรวม 3",
                    "en": "Lecture Classroom 3",
                },
                "floors": [],
            },

            "LC4": {
                "id": "building-002",
                "code": "LC4",
                "name": {
                    "th": "อาคารบรรยายรวม 4",
                    "en": "Lecture Classroom 4",
                },
                "floors": [
                    {
                        "id": "floor-002",
                        "floor_number": 2,
                        "floor_plan_key": "floor-plan/LC4/LC4-floor2.svg",
                        "facilities": [
                            {
                                "id": "facility-002",
                                "name": {
                                    "th": "ลิฟต์",
                                    "en": "Elevator",
                                },
                                "description": {
                                    "th": "ลิฟต์สำหรับให้บริการภายในอาคาร",
                                    "en": "Elevator serving the building",
                                },
                                "type": "ELEVATOR",
                                "latitude": 14.0726,
                                "longitude": 100.6061,
                            }
                        ],
                    }
                ],
            },
        },

        [
            {"code": "LC3"},
            {"code": "LC4"},
        ],
    )

    result = service.get_facility("facility-002")

    assert result["id"] == "facility-002"

    assert result["building"]["id"] == "building-002"
    assert result["building"]["code"] == "LC4"

    assert result["floor"]["id"] == "floor-002"
    assert result["floor"]["floor_number"] == 2


# TC05 - Skip Building Without Code
def test_skip_building_without_code():

    service = make_service(
        {},
        [
            {"id": "building-001"},
            {"code": "LC3"},
        ],
    )

    with pytest.raises(FacilityNotFound) as error:
        service.get_facility("facility-001")

    assert error.value.status_code == 404
    assert error.value.code == "FACILITY_NOT_FOUND"


# TC06 - Skip Missing Building Data
def test_skip_missing_building_data():

    service = make_service(
        {},
        [
            {"code": "LC3"},
        ],
    )

    with pytest.raises(FacilityNotFound) as error:
        service.get_facility("facility-001")

    assert error.value.status_code == 404
    assert error.value.code == "FACILITY_NOT_FOUND"


# TC07 - Building Without Floors
def test_building_without_floors():

    service = make_service({

        "LC3": {
            "id": "building-001",
            "code": "LC3",
            "floors": [],
        }

    })

    with pytest.raises(FacilityNotFound) as error:
        service.get_facility("facility-001")

    assert error.value.status_code == 404
    assert error.value.code == "FACILITY_NOT_FOUND"


# TC08 - Floor Without Facilities
def test_floor_without_facilities():

    service = make_service({

        "LC3": {
            "id": "building-001",
            "code": "LC3",
            "floors": [
                {
                    "id": "floor-001",
                    "floor_number": 1,
                    "floor_plan_key": "floor-plan/LC3/LC3-floor1.svg",
                    "facilities": [],
                }
            ],
        }

    })

    with pytest.raises(FacilityNotFound) as error:
        service.get_facility("facility-001")

    assert error.value.status_code == 404
    assert error.value.code == "FACILITY_NOT_FOUND"
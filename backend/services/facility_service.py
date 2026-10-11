from typing import Any

from errors import FacilityNotFound, FloorNotFound, BuildingNotFound
from ports.facility_source import FacilitySource


class FacilityService:
    def __init__(self, source: FacilitySource):
        self.source = source

    def get_facility(
        self, facility_id: str
    ) -> dict[str, Any]:
        facility = self.source.get_facility(facility_id)

        if facility is None:
            raise FacilityNotFound(facility_id)


        floor_id = facility.get("floor_id")
        building_id = facility.get("building_id")

        floor = (
            self.source.get_floor(str(floor_id))
            if floor_id
            else None
        )
        if floor is None:
            raise FloorNotFound(str(floor_id or ""))

        building = (
            self.source.get_building(str(building_id))
            if building_id
            else None
        )
        if building is None:
            raise BuildingNotFound(str(building_id or ""))
        
        return {
            "id": facility.get("id"),
            "name": facility.get("name"),
            "description": facility.get("description"),
            "type": facility.get("type"),
            "latitude": facility.get("latitude"),
            "longitude": facility.get("longitude"),
            "building": {
                "id": building.get("id"),
                "code": building.get("code"),
                "name": building.get("name"),
            },
            "floor": {
                "id": floor.get("id"),
                "floor_number": floor.get("floor_number"),
            },
            "floor_plan": floor.get("floor_plan", {}),
        }
"""
Facility use cases.

This logic previously lived in the repository, where it did not belong:
walking floors to find a facility is a business rule, not data access.

Layer: application. Depends on the BuildingSource port, never on boto3.
"""

from typing import Any

from errors import FacilityNotFound
from models.facility import find_facility
from ports.building_source import BuildingSource


class FacilityService:

    def __init__(self, source: BuildingSource):
        self.source = source

    def get_facility(self, facility_id: str) -> dict[str, Any]:
        """
        Find a facility by its ID and build the API response.
        """

        buildings = self.source.list_buildings()

        for building in buildings:
            building_code = building.get("code")

            if not building_code:
                continue

            building_data = self.source.get_building(building_code)

            if not building_data:
                continue

            for floor in building_data.get("floors", []):
                facility = find_facility(
                    floor.get("facilities", []),
                    facility_id,
                )

                if facility is None:
                    continue

                return {
                    "id": facility["id"],
                    "name": facility.get("name"),
                    "description": facility.get("description"),
                    "type": facility.get("type"),
                    "latitude": facility.get("latitude"),
                    "longitude": facility.get("longitude"),
                    "building": {
                        "id": building_data["id"],
                        "code": building_data["code"],
                        "name": building_data.get("name"),
                    },
                    "floor": {
                        "id": floor["id"],
                        "floor_number": floor.get("floor_number"),
                    },
                    "floor_plan": {
                        "type": "svg",
                        "url": self.source.presigned_url(
                            floor["floor_plan_key"]
                        ),
                    },
                }

        raise FacilityNotFound(facility_id)
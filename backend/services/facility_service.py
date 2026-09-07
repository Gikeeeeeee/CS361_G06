"""
Facility use cases.

This logic previously lived in the repository, where it did not belong: walking
floors to find a facility is a business rule, not data access.

Layer: application. Depends on the BuildingSource port, never on boto3.
"""

from typing import Any

from errors import FacilityNotFound
from models.facility import find_facility
from ports.building_source import BuildingSource
from services.floor_service import load_floor


class FacilityService:
    def __init__(self, source: BuildingSource):
        self.source = source

    def get_facility(
        self, building_id: str, floor_id: str, facility_id: str
    ) -> dict[str, Any]:
        """One facility's stored record."""
        _, floor = load_floor(self.source, building_id, floor_id)
        facility = find_facility(floor.get("facilities", []), facility_id)

        if facility is None:
            raise FacilityNotFound(building_id, floor_id, facility_id)

        return facility

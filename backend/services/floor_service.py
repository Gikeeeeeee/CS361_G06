"""
Floor use cases.

Layer: application. Depends on the BuildingSource port, never on boto3.
"""

from typing import Any

from errors import BuildingNotFound, FloorNotFound
from models.facility import facility_pin
from models.floor import find_floor
from models.room import room_pin
from ports.building_source import BuildingSource


def load_floor(
    source: BuildingSource, building_id: str, floor_id: str
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Load `(building_raw, floor_raw)` or raise.

    Shared by the room and facility use cases -- both still address a floor
    through its building -- so that "fetch the building, then locate the floor"
    exists in exactly one place.
    """
    raw = source.get_building(building_id)

    if not raw:
        raise BuildingNotFound(building_id)

    floor = find_floor(raw.get("floors", []), floor_id)

    if floor is None:
        raise FloorNotFound(floor_id, building_id)

    return raw, floor


class FloorService:
    def __init__(self, source: BuildingSource):
        self.source = source

    def get_details(self, floor_id: str) -> dict[str, Any]:
        """
        Full floor detail: the SVG plan URL plus the room and facility pins to
        render on it.

        The floor is addressed by uuid alone; asking the port for it keeps the
        "which building holds this floor?" search on the storage side.

        Rooms and facilities are projected down to pin data. The stored records
        carry more than that (amenities, image keys, descriptions), and those
        fields belong to the per-room and per-facility endpoints.
        """
        floor = self.source.get_floor(floor_id)

        if floor is None:
            raise FloorNotFound(floor_id)

        return {
            "id": floor.get("id"),
            "floor_number": floor.get("floor_number"),
            "floor_plan": {
                "type": "svg",
                "url": self.source.presigned_url(floor.get("floor_plan_key")),
            },
            "rooms": [room_pin(room) for room in floor.get("rooms") or []],
            "facilities": [
                facility_pin(facility)
                for facility in floor.get("facilities") or []
            ],
        }

"""
Floor use cases.

Layer: application. Depends on the BuildingSource port, never on boto3.
"""

from typing import Any

from errors import BuildingNotFound, FloorNotFound
from models.floor import find_floor, map_key
from ports.building_source import BuildingSource


def load_floor(
    source: BuildingSource, building_id: str, floor_id: str
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Load `(building_raw, floor_raw)` or raise.

    Shared by the floor, room and facility use cases so that "fetch the
    building, then locate the floor" exists in exactly one place.
    """
    raw = source.get_building(building_id)

    if not raw:
        raise BuildingNotFound(building_id)

    floor = find_floor(raw.get("floors", []), floor_id)

    if floor is None:
        raise FloorNotFound(building_id, floor_id)

    return raw, floor


class FloorService:
    def __init__(self, source: BuildingSource):
        self.source = source

    def get_details(self, building_id: str, floor_id: str) -> dict[str, Any]:
        """
        Full floor detail: the SVG plan URL plus its rooms and facilities.

        Rooms and facilities are passed through unchanged -- the floor endpoint
        is a listing, and the per-room / per-facility endpoints are what serve
        detail.
        """
        raw, floor = load_floor(self.source, building_id, floor_id)
        building_name = raw.get("name", building_id)

        return {
            "id": floor.get("id"),
            "floor_number": floor.get("floor_number"),
            "map": {
                "type": "svg",
                "url": self.source.presigned_url(map_key(building_name, floor)),
            },
            "rooms": floor.get("rooms", []),
            "facilities": floor.get("facilities", []),
        }

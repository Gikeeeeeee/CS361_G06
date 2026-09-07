"""
Room use cases.

Layer: application. Depends on the BuildingSource port, never on boto3.
"""

from typing import Any

from errors import RoomNotFound
from models.room import find_room
from ports.building_source import BuildingSource
from services.floor_service import load_floor


class RoomService:
    def __init__(self, source: BuildingSource):
        self.source = source

    def get_room(
        self, building_id: str, floor_id: str, room_id: str
    ) -> dict[str, Any]:
        """One room's stored record."""
        _, floor = load_floor(self.source, building_id, floor_id)
        room = find_room(floor.get("rooms", []), room_id)

        if room is None:
            raise RoomNotFound(building_id, floor_id, room_id)

        return room

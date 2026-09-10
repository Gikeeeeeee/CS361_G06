"""
Room use cases.

Layer: application. Depends on the BuildingSource port, never on boto3.
"""

from typing import Any

from errors import RoomNotFound
from models.room import find_room
from ports.building_source import BuildingSource


class RoomService:

    def __init__(self, source: BuildingSource):
        self.source = source

    def get_room(self, room_id: str) -> dict[str, Any]:
        """Return room information by room ID."""

        for building in self.source.list_buildings():
            building_id = building.get("id")

            if not building_id:
                continue

            building_data = self.source.get_building(
                str(building_id)
            )

            if building_data is None:
                continue

            for floor in building_data.get("floors", []):
                room = find_room(
                    floor.get("rooms", []),
                    room_id,
                )

                if room is None:
                    continue

                return {
                    "id": room.get("id"),
                    "room_number": room.get("room_number"),
                    "name": room.get("name"),
                    "type": room.get("type"),
                    "facilities": room.get("facilities", {}),
                    "schedule": room.get("schedule", {}),
                    "event": room.get("event", {}),
                    "image_url": room.get("image_url"),
                    "latitude": room.get("latitude"),
                    "longitude": room.get("longitude"),
                    "building": {
                        "id": building_data.get("id"),
                        "code": building_data.get("code"),
                        "name": building_data.get("name"),
                    },
                    "floor": {
                        "id": floor.get("id"),
                        "floor_number": floor.get("floor_number"),
                    },
                    "floor_plan": floor.get("floor_plan", {}),
                }

        raise RoomNotFound(room_id)
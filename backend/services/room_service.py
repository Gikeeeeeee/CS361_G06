from typing import Any

from errors import RoomNotFound, FloorNotFound, BuildingNotFound
from ports.room_source import RoomSource


class RoomService:
    def __init__(self, source: RoomSource):
        self.source = source

    def get_room(self, room_id: str) -> dict[str, Any]:
        room = self.source.get_room(room_id)

        if room is None:
            raise RoomNotFound(room_id)

        floor_id = room.get("floor_id")
        floor = self.source.get_floor(str(floor_id)) if floor_id else None

        if floor is None:
            raise FloorNotFound(str(floor_id or ""))

        building_id = room.get("building_id") or floor.get("building_id")
        building = (
            self.source.get_building(str(building_id))
            if building_id
            else None
        )

        if building is None:
            raise BuildingNotFound(str(building_id or ""))

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
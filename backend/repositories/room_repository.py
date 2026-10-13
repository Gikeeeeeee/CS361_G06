from typing import Any

from repositories.dynamodb_entity_reader import DynamoDBEntityReader


class RoomRepository:
    def __init__(self, reader: DynamoDBEntityReader | None = None):
        self.reader = reader or DynamoDBEntityReader()

    def get_room(self, room_id: str) -> dict[str, Any] | None:
        return self.reader.find_by_id(
            "ROOM",
            room_id,
            match_room_number=True,
        )

    def get_floor(self, floor_id: str) -> dict[str, Any] | None:
        return self.reader.find_by_id("FLOOR", floor_id)

    def get_building(self, building_id: str) -> dict[str, Any] | None:
        building = self.reader.find_by_id("BUILDING", building_id)

        if building is not None:
            return building

        # รองรับกรณี caller ส่ง building code เช่น LC3
        return self.reader.find_by_id("BUILDING", building_id.upper())
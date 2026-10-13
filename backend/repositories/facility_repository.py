from typing import Any

from repositories.dynamodb_entity_reader import DynamoDBEntityReader


class FacilityRepository:
    def __init__(self, reader: DynamoDBEntityReader | None = None):
        self.reader = reader or DynamoDBEntityReader()

    def get_facility(self, facility_id: str) -> dict[str, Any] | None:
        return self.reader.find_by_id("FACILITY", facility_id)

    def get_floor(self, floor_id: str) -> dict[str, Any] | None:
        return self.reader.find_by_id("FLOOR", floor_id)

    def get_building(self, building_id: str) -> dict[str, Any] | None:
        building = self.reader.find_by_id("BUILDING", building_id)

        if building is not None:
            return building

        return self.reader.find_by_id("BUILDING", building_id.upper())
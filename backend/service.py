from repository import BuildingRepository


class BuildingService:
    def __init__(self, repository: BuildingRepository | None = None):
        self.repository = repository or BuildingRepository()

    def get_building_summary(self, building_id: str) -> dict | None:
        """
        Retrieves building details and floor metadata,
        omitting rooms and facilities.
        """
        raw_data = self.repository.get_building_raw(building_id)

        if not raw_data:
            return None

        floors_summary = [
            {
                "id": floor.get("id"),
                "floor_number": floor.get("floor_number")
            }
            for floor in raw_data.get("floors", [])
        ]

        return {
            "id": raw_data.get("id"),
            "name": raw_data.get("name"),
            "latitude": raw_data.get("latitude"),
            "longitude": raw_data.get("longitude"),
            "floors": floors_summary
        }

    def get_all_buildings(self) -> list[dict]:
        return self.repository.get_all()
    
    def get_room_info(self, building_id: str, floor_id: str, room_id: str) -> dict | None:
        """
        Retrieves specific room details matching floor and room identifiers.
        """
        raw_data = self.repository.get_building_raw(building_id)

        if not raw_data:
            return None
        target_floor = None
        for floor in raw_data.get("floors", []):
            if (
                str(floor.get("id")) == str(floor_id) 
                or str(floor.get("floor_number")) == str(floor_id)
            ):
                target_floor = floor
                break

        if not target_floor:
            return None

        for room in target_floor.get("rooms", []):
            if (
                str(room.get("id")) == str(room_id) 
                or str(room.get("room_number")) == str(room_id)
            ):
                return room

        return None
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
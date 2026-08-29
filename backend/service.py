try:
    from repository import BuildingRepository
except ImportError:
    from .repository import BuildingRepository


class BuildingService:
    def __init__(self, repository: BuildingRepository = None):
        self.repository = repository or BuildingRepository()

    def get_building_summary(self, building_id: str) -> dict | None:
        """
        Retrieves building details and floor metadata, omitting rooms and facilities.
        """
        raw_data = self.repository.get_building_raw(building_id)
        if not raw_data:
            return None

        # Filter floor details to include only id and floor_number
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

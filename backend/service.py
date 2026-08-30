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

    def get_floor_details(self, building_id: str, floor_id: str) -> dict | None:
        """
        Retrieves detailed floor data including SVG map presigned URL, rooms, and facilities.
        """
        raw_data = self.repository.get_building_raw(building_id)
        if not raw_data:
            return None

        building_name = raw_data.get("name", building_id)
        floors = raw_data.get("floors", [])

        # Find matching floor by id or floor_number
        target_floor = None
        for floor in floors:
            if floor.get("id") == floor_id or str(floor.get("floor_number")) == str(floor_id):
                target_floor = floor
                break

        if not target_floor:
            return None

        floor_number = target_floor.get("floor_number")

        # Determine S3 key for SVG map
        map_key = target_floor.get("map_key") or target_floor.get("map_file") or f"floor-plan/{building_name}/{building_name}-floor{floor_number}-neutral.svg"

        # Generate presigned URL for the SVG file
        map_url = self.repository.generate_presigned_url(map_key)

        return {
            "id": target_floor.get("id"),
            "floor_number": floor_number,
            "map": {
                "type": "svg",
                "url": map_url
            },
            "rooms": target_floor.get("rooms", []),
            "facilities": target_floor.get("facilities", [])
        }

    def get_all_buildings(self) -> list[dict]:
        return self.repository.get_all()

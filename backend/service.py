from repository import LocalBuildingRepository

class BuildingService:

    def __init__(self, repository: LocalBuildingRepository):
        self.repository = repository

    def get_all_buildings(self) -> list[dict]:
        return self.repository.get_all()
"""
Building use cases.

Layer: application. Depends on the BuildingSource port, never on boto3.
"""

from typing import Any

from errors import BuildingNotFound
from models.building import Building
from ports.building_source import BuildingSource


class BuildingService:
    def __init__(self, source: BuildingSource):
        self.source = source

    def list_buildings(self) -> list[dict[str, Any]]:
        """Every building in the index."""
        return self.source.list_buildings()

    def get_summary(self, building_id: str) -> dict[str, Any]:
        """Building details and floor metadata, without rooms or facilities."""
        raw = self.source.get_building(building_id)

        if not raw:
            raise BuildingNotFound(building_id)

        image_url = raw.get("image_url")
        if not image_url and raw.get("image_key"):
            image_url = self.source.presigned_url(raw["image_key"])

        return Building.from_raw(raw, image_url=image_url).summary()

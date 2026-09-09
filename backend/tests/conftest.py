"""
Shared pytest fixtures for CS361 backend tests.
"""

from typing import Any
import pytest


class FakeBuildingSource:
    """In-memory fake implementation of ports.building_source.BuildingSource."""

    def __init__(self, buildings: dict[str, dict[str, Any]] | None = None):
        self._buildings = buildings or {}

    def list_buildings(self) -> list[dict[str, Any]]:
        return list(self._buildings.values())

    def get_building(self, building_id: str) -> dict[str, Any] | None:
        for candidate in [building_id, building_id.upper(), building_id.lower()]:
            if candidate in self._buildings:
                return self._buildings[candidate]
        return None

    def presigned_url(self, key: str, expires_in: int = 3600) -> str:
        return f"https://mock-bucket.s3.amazonaws.com/{key}?expires={expires_in}"


@pytest.fixture
def sample_building_raw() -> dict[str, Any]:
    """Sample raw building data matching the S3 JSON format."""
    return {
        "id": "lc3",
        "code": "LC3",
        "name": {
            "th": "อาคารบรรยายรวม 3",
            "en": "Lecture Classroom 3",
        },
        "description": {
            "th": "อาคารเรียนรวม...",
            "en": "A lecture building...",
        },
        "image_key": "image/building/LC3.webp",
        "opening_hours": "08:00-18:00",
        "latitude": 14.0726,
        "longitude": 100.6062,
        "floors": [
            {
                "id": "floor-uuid-1",
                "floor_number": 1,
                "floor_plan_key": "floor-plan/LC3/floor1.svg",
                "rooms": [
                    {
                        "id": "room-uuid-1",
                        "name": "101",
                        "type": "CLASSROOM",
                    }
                ],
                "facilities": [
                    {
                        "id": "facility-uuid-1",
                        "name": "Restroom",
                        "type": "TOILET",
                    }
                ],
            }
        ],
    }


@pytest.fixture
def fake_source(sample_building_raw: dict[str, Any]) -> FakeBuildingSource:
    return FakeBuildingSource({"lc3": sample_building_raw})

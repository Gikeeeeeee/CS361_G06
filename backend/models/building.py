"""
Building domain model.

Layer: domain / core.
"""

from dataclasses import dataclass
from typing import Any

from models.floor import floor_summary


@dataclass(frozen=True)
class Building:
    """A building and its floors, as stored in `building/<ID>.json`."""

    id: Any
    name: Any
    latitude: Any
    longitude: Any
    floors: list[dict[str, Any]]

    @classmethod
    def from_raw(cls, raw: dict[str, Any]) -> "Building":
        return cls(
            id=raw.get("id"),
            name=raw.get("name"),
            latitude=raw.get("latitude"),
            longitude=raw.get("longitude"),
            floors=raw.get("floors", []),
        )

    def summary(self) -> dict[str, Any]:
        """
        Building details plus floor metadata, omitting rooms and facilities.

        This is the response body of GET /api/v1/buildings/{buildingId}.
        """
        return {
            "id": self.id,
            "name": self.name,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "floors": [floor_summary(floor) for floor in self.floors],
        }

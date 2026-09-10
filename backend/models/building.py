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
    code: Any
    name: Any
    description: Any
    image_url: Any
    opening_hours: Any
    latitude: Any
    longitude: Any
    floors: list[dict[str, Any]]

    @classmethod
    def from_raw(cls, raw: dict[str, Any], image_url: str | None = None) -> "Building":
        return cls(
            id=raw.get("id"),
            code=raw.get("code"),
            name=raw.get("name"),
            description=raw.get("description"),
            image_url=image_url or raw.get("image_url"),
            opening_hours=raw.get("opening_hours"),
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
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "image_url": self.image_url,
            "opening_hours": self.opening_hours,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "floors": [floor_summary(floor) for floor in self.floors],
        }

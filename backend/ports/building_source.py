"""
Driven port: the interface the application core owns.

`services/` depends on THIS, never on `repositories/`. That is what makes the
architecture hexagonal rather than plain three-tier layering: the dependency
arrow points inward, and the S3 adapter can be swapped for an in-memory fake
without touching a single service.

Layer: port (owned by the core).
"""

from typing import Any, Protocol


class BuildingSource(Protocol):
    """Read-only access to building data, wherever it happens to live."""

    def list_buildings(self) -> list[dict[str, Any]]:
        """Return every building summary from the building index."""
        ...

    def get_building(self, building_id: str) -> dict[str, Any] | None:
        """Return one building's raw record, or None if it does not exist."""
        ...

    def presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Return a time-limited URL for a stored asset (e.g. a floor plan)."""
        ...

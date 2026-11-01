"""
Dynamic Status application service.

Coordinates status overlay retrieval and real-time state updates for
interactive SVG floor plans and graph exclusion routing.
Layer: service (use case / application).
"""

from typing import Any

from repositories.status_repository import StatusRepository


class StatusService:
    """Service handling status overlays and dynamic status updates."""

    def __init__(self, repository: StatusRepository):
        self.repository = repository

    def get_floor_status_overlay(self, floor_id: str) -> dict[str, Any]:
        """Fetch floor status overlay for rooms, corridor edges, and navigation nodes."""
        return self.repository.get_floor_status_overlay(floor_id)

    def update_room_status(
        self,
        room_id: str,
        body: dict[str, Any],
        updated_by: str | None = None,
    ) -> dict[str, Any]:
        """Update room operational status (ACTIVE, CLOSED, MAINTENANCE)."""
        status = body.get("status", "")
        status_note = body.get("status_note")
        return self.repository.update_room_status(
            room_id=room_id,
            status=status,
            status_note=status_note,
            updated_by=updated_by,
        )

    def update_corridor_edge_status(
        self,
        edge_id: str,
        body: dict[str, Any],
        updated_by: str | None = None,
    ) -> dict[str, Any]:
        """Update corridor edge traversal status (ACTIVE, BLOCKED)."""
        status = body.get("status", "")
        status_note = body.get("status_note")
        return self.repository.update_corridor_edge_status(
            edge_id=edge_id,
            status=status,
            status_note=status_note,
            updated_by=updated_by,
        )

    def update_navigation_node_status(
        self,
        node_id: str,
        body: dict[str, Any],
        updated_by: str | None = None,
    ) -> dict[str, Any]:
        """Update navigation node traversal status (ACTIVE, BLOCKED)."""
        status = body.get("status", "")
        status_note = body.get("status_note")
        return self.repository.update_navigation_node_status(
            node_id=node_id,
            status=status,
            status_note=status_note,
            updated_by=updated_by,
        )


"""
NavigationSource port interface.

Pure Python: no AWS SDK, no HTTP, no framework.
Layer: port (domain boundary).
"""

from abc import ABC, abstractmethod
from typing import Any


class NavigationSource(ABC):
    """Outbound port for fetching navigation nodes, corridor edges, and attachments."""

    @abstractmethod
    def get_floor_navigation_data(self, floor_id: str) -> dict[str, Any]:
        """
        Return all navigation items under the floor partition:
        {
            "nodes": [NavigationNode, ...],
            "edges": [CorridorEdge, ...],
            "qrs": [QRLocation, ...],
            "rooms": [RoomAttachment, ...],
        }
        """
        raise NotImplementedError

    @abstractmethod
    def get_room(self, room_id: str) -> dict[str, Any] | None:
        """Fetch raw room data by UUID or room number."""
        raise NotImplementedError

    @abstractmethod
    def get_floor(self, floor_id: str) -> dict[str, Any] | None:
        """Fetch raw floor data by UUID."""
        raise NotImplementedError

    @abstractmethod
    def find_qr(self, qr_id: str, floor_id: str | None = None) -> dict[str, Any] | None:
        """Locate a QR code record by ID."""
        raise NotImplementedError

    @abstractmethod
    def find_node(
        self, node_id: str, floor_id: str | None = None
    ) -> dict[str, Any] | None:
        """Locate a navigation node record by ID."""
        raise NotImplementedError

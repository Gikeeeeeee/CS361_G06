"""
Navigation domain models for CS361 V4 Visual Navigation.

Pure Python: no AWS SDK, no HTTP, no framework.
Layer: domain / core.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class NavigationNode:
    """A vertex in the floor navigation graph."""

    id: str
    name: str | None = None
    node_type: str = "JUNCTION"
    status: str = "ACTIVE"
    svg_x: float = 0.0
    svg_y: float = 0.0
    floor_id: str = ""

    @property
    def is_active(self) -> bool:
        return (self.status or "").upper() == "ACTIVE"


@dataclass(frozen=True)
class CorridorEdge:
    """A physical corridor hallway connecting two navigation nodes."""

    id: str
    from_node_id: str
    to_node_id: str
    distance_weight: float
    status: str = "ACTIVE"
    floor_id: str = ""

    @property
    def is_active(self) -> bool:
        return (self.status or "").upper() == "ACTIVE"


@dataclass(frozen=True)
class QRLocation:
    """A physical QR checkpoint associated with a navigation node."""

    id: str
    node_id: str
    location_description: str | None = None
    floor_id: str = ""


@dataclass(frozen=True)
class RoomAttachment:
    """Corridor-spine attachment metadata for a room."""

    room_id: str
    room_number: str | None = None
    name: Any = None
    corridor_edge_id: str = ""
    door_svg_x: float | None = None
    door_svg_y: float | None = None
    side: str = "RIGHT"
    sequence_order: int | None = None
    floor_id: str = ""
    building_id: str = ""
    status: str = "ACTIVE"

    @property
    def is_active(self) -> bool:
        return (self.status or "").upper() not in {"BLOCKED", "CLOSED", "MAINTENANCE"}

    @property
    def display_name(self) -> str:
        if self.room_number:
            return f"Room {self.room_number}"
        if isinstance(self.name, dict):
            return self.name.get("en") or self.name.get("th") or self.room_id
        if self.name:
            return str(self.name)
        return self.room_id


@dataclass
class RoutePathPoint:
    """A point along the computed SVG route line."""

    x: float
    y: float
    node_id: str | None = None
    name: str | None = None
    is_room_door: bool = False

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "x": round(self.x, 2),
            "y": round(self.y, 2),
        }
        if self.node_id:
            result["node_id"] = self.node_id
        if self.name:
            result["name"] = self.name
        if self.is_room_door:
            result["is_room_door"] = True
        return result


@dataclass
class RouteStep:
    """A single human-readable step-by-step navigation instruction."""

    step_index: int
    action: str
    instruction: str
    distance: float
    path_indices: list[int] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "step_index": self.step_index,
            "action": self.action,
            "instruction": self.instruction,
            "distance": round(self.distance, 2),
            "path_indices": list(self.path_indices),
        }


@dataclass
class RouteSummary:
    """High-level summary of a calculated route."""

    floor_id: str
    building_id: str
    total_distance: float
    estimated_time_seconds: int | None = None
    is_rerouted: bool = False
    start_location: dict[str, Any] = field(default_factory=dict)
    destination: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "floor_id": self.floor_id,
            "building_id": self.building_id,
            "total_distance": round(self.total_distance, 2),
            "estimated_time_seconds": self.estimated_time_seconds,
            "is_rerouted": self.is_rerouted,
            "start_location": dict(self.start_location),
            "destination": dict(self.destination),
        }


@dataclass
class RouteResult:
    """Complete route calculation payload returned by Visual Navigation API."""

    summary: RouteSummary
    svg_path: dict[str, Any]
    steps: list[RouteStep]

    def to_dict(self) -> dict[str, Any]:
        return {
            "summary": self.summary.to_dict(),
            "svg_path": self.svg_path,
            "steps": [s.to_dict() for s in self.steps],
        }


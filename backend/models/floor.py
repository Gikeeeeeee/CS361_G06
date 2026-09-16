"""
Floor domain rules.

The "a floor may be addressed by its uuid OR by its floor number" rule used to
be written out three separate times (twice in service.py, once in
repository.py). It lives here now, once.

Layer: domain / core.
"""

from typing import Any


def find_floor(floors: list[dict[str, Any]], floor_id: str) -> dict[str, Any] | None:
    """
    Return the floor addressed by `floor_id`, or None.

    A floor matches when `floor_id` equals either its `id` (a uuid) or its
    `floor_number`. Both sides are compared as strings, because path parameters
    always arrive as strings while `floor_number` is stored as an int.
    """
    for floor in floors or []:
        if (
            str(floor.get("id")) == str(floor_id)
            or str(floor.get("floor_number")) == str(floor_id)
        ):
            return floor

    return None


def floor_summary(floor: dict[str, Any]) -> dict[str, Any]:
    """The floor projection used inside a building summary (no rooms/facilities)."""
    return {
        "id": floor.get("id"),
        "floor_number": floor.get("floor_number"),
    }

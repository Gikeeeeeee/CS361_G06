"""
Room domain rules.

Layer: domain / core.
"""

from typing import Any


def find_room(rooms: list[dict[str, Any]], room_id: str) -> dict[str, Any] | None:
    """
    Return the room addressed by `room_id`, or None.

    A room matches on either its `id` (a uuid) or its `room_number`.
    """
    for room in rooms or []:
        if (
            str(room.get("id")) == str(room_id)
            or str(room.get("room_number")) == str(room_id)
        ):
            return room

    return None

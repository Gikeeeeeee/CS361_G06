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


def room_pin(room: dict[str, Any]) -> dict[str, Any]:
    """
    The room projection used by the floor endpoint: enough to drop a pin on
    the plan, and nothing else.

    Stored records also carry amenities, `image_key` and `description`. Those
    belong to `GET .../rooms/{roomId}`, so passing the record through raw would
    leak them into a response whose contract does not have them.
    """
    return {
        "id": room.get("id"),
        "room_number": room.get("room_number"),
        "name": room.get("name"),
        "type": room.get("type"),
        "latitude": room.get("latitude"),
        "longitude": room.get("longitude"),
    }

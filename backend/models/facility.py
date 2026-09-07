"""
Facility domain rules.

Layer: domain / core.
"""

from typing import Any


def find_facility(
    facilities: list[dict[str, Any]], facility_id: str
) -> dict[str, Any] | None:
    """
    Return the facility addressed by `facility_id`, or None.

    Facilities are addressed by `id` only (unlike rooms, they carry no
    secondary human-readable number).
    """
    for facility in facilities or []:
        if str(facility.get("id")) == str(facility_id):
            return facility

    return None

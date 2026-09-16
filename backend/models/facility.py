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


def facility_pin(facility: dict[str, Any]) -> dict[str, Any]:
    """
    The facility projection used by the floor endpoint -- pin data only.

    `description` is dropped: it belongs to `GET .../facilities/{facilityId}`.
    """
    return {
        "id": facility.get("id"),
        "name": facility.get("name"),
        "type": facility.get("type"),
        "latitude": facility.get("latitude"),
        "longitude": facility.get("longitude"),
    }

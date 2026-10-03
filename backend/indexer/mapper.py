from __future__ import annotations

from typing import Any

from boto3.dynamodb.types import TypeDeserializer


_deserializer = TypeDeserializer()


def _localized_text(
    value: Any,
    language: str,
) -> str | None:
    if isinstance(value, dict):
        text = value.get(language)
        if text is not None:
            return str(text)

    if value is not None and not isinstance(value, dict):
        return str(value)

    return None


def deserialize_item(item: dict[str, Any]) -> dict[str, Any]:
    """
    Convert DynamoDB AttributeValue format into normal Python values.

    Example:
        {"id": {"S": "room-lc3-201"}}
        ->
        {"id": "room-lc3-201"}
    """
    return {
        key: _deserializer.deserialize(value)
        for key, value in item.items()
    }


def _first(item: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = item.get(key)

        if value is not None:
            return value

    return None


def get_entity_type(item: dict[str, Any]) -> str:
    value = item.get("GSI0PK")

    if value:
        return str(value).upper()

    # Support already-normalized documents if needed.
    value = item.get("entity_type")

    if value:
        return str(value).upper()

    # Schedule records may not have GSI0PK.
    value = item.get("GSI6PK")

    if value:
        value = str(value).upper()

        if value.startswith("TYPE#"):
            return "SCHEDULE"

    return "UNKNOWN"

def get_document_id(item: dict[str, Any]) -> str:
    """
    Resolve a stable OpenSearch document ID.

    Prefer the application's explicit `id`.
    """
    value = item.get("id")

    if value:
        return str(value)

    # Fallbacks for data that does not contain an explicit id.
    pk = item.get("PK") or item.get("pk")
    sk = item.get("SK") or item.get("sk")

    if pk and sk:
        return f"{pk}#{sk}"

    if pk:
        return str(pk)

    raise ValueError("Unable to determine OpenSearch document id.")


def to_search_document(item: dict[str, Any]) -> dict[str, Any]:
    entity_type = get_entity_type(item)
    document_id = get_document_id(item)

    name = item.get("name")

    name_th = _localized_text(name, "th")
    name_en = _localized_text(name, "en")

    description = item.get("description")

    description_th = _localized_text(description, "th")
    description_en = _localized_text(description, "en")

    document = {
        "id": document_id,
        "entity_type": entity_type,

        # Common
        "title": (
            name_en
            or item.get("title")
            or item.get("course_name")
            or item.get("room_name")
            or item.get("building_name")
        ),
        "title_th": name_th,
        "title_en": name_en,

        # Building
        "code": item.get("code"),

        # Room
        "room_number": item.get("room_number"),

        # Schedule
        "type": item.get("type"),
        "course_code": item.get("course_code"),
        "organizer": item.get("organizer"),
        "start_at": item.get("start_at"),
        "end_at": item.get("end_at"),
        "time_zone": item.get("time_zone"),
        "recurrence_rule": item.get("recurrence_rule"),
        "room_id": item.get("room_id"),
        "status": item.get("status"),

        # Facility
        "facility_type": (
            item.get("type")
            if entity_type == "FACILITY"
            else None
        ),

        # Text
        "description": (
            description_en
            or description_th
        ),
        "description_th": description_th,
        "description_en": description_en,
    }

    return {
        key: value
        for key, value in document.items()
        if value is not None
    }


def map_stream_image(image: dict[str, Any]) -> dict[str, Any]:
    """
    Convert a DynamoDB Stream image directly into a search document.
    """
    item = deserialize_item(image)

    return to_search_document(item)


def get_deleted_document_id(keys: dict[str, Any]) -> str:
    """
    Resolve document ID from DynamoDB Stream Keys for REMOVE events.
    """
    item = deserialize_item(keys)

    return get_document_id(item)
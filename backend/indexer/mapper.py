from __future__ import annotations

from typing import Any

from boto3.dynamodb.types import TypeDeserializer


_deserializer = TypeDeserializer()


def _localized_text(
    value: Any,
    language: str,
) -> str | None:
    """Get localized text."""
    if isinstance(value, dict):
        text = value.get(language)
        if text is not None:
            return str(text)

    if value is not None and not isinstance(value, dict):
        return str(value)

    return None


def deserialize_item(item: dict[str, Any]) -> dict[str, Any]:
    """Convert DynamoDB values to Python values."""
    return {
        key: _deserializer.deserialize(value)
        for key, value in item.items()
    }


def _first(item: dict[str, Any], *keys: str) -> Any:
    """Return the first available value."""
    for key in keys:
        value = item.get(key)
        if value is not None:
            return value

    return None


def get_entity_type(item: dict[str, Any]) -> str:
    """Get the entity type."""
    value = item.get("GSI0PK")
    if value:
        return str(value).upper()

    value = item.get("entity_type")
    if value:
        return str(value).upper()

    value = item.get("GSI6PK")
    if value:
        value = str(value).upper()
        if value.startswith("TYPE#"):
            return "SCHEDULE"

    return "UNKNOWN"


def get_document_id(item: dict[str, Any]) -> str:
    """Get a stable document ID."""
    value = item.get("id")
    if value:
        return str(value)

    pk = item.get("PK") or item.get("pk")
    sk = item.get("SK") or item.get("sk")

    if pk and sk:
        return f"{pk}#{sk}"

    if pk:
        return str(pk)

    raise ValueError("Unable to determine OpenSearch document id.")


def get_building_id(
    item: dict[str, Any],
    entity_type: str,
) -> str | None:
    """Get the building ID."""
    if entity_type == "BUILDING":
        value = item.get("id")
        return str(value) if value is not None else None

    value = _first(
        item,
        "building_id",
        "buildingId",
        "buildingID",
    )

    if value is not None:
        return str(value)

    return None


def get_building_code(
    item: dict[str, Any],
    entity_type: str,
) -> str | None:
    """Get the building code."""
    if entity_type == "BUILDING":
        value = item.get("code")
    else:
        value = _first(
            item,
            "building_code",
            "buildingCode",
            "building_code",
        )

    if value is not None:
        return str(value)

    return None


def to_search_document(item: dict[str, Any]) -> dict[str, Any]:
    """Convert a DynamoDB item to a search document."""
    entity_type = get_entity_type(item)
    document_id = get_document_id(item)

    name = item.get("name")
    name_th = _localized_text(name, "th")
    name_en = _localized_text(name, "en")

    description = item.get("description")
    description_th = _localized_text(description, "th")
    description_en = _localized_text(description, "en")

    building_id = get_building_id(
        item,
        entity_type,
    )

    building_code = get_building_code(
        item,
        entity_type,
    )

    document = {
        "id": document_id,
        "entity_type": entity_type,

        "title": (
            name_en
            or item.get("title")
            or item.get("course_name")
            or item.get("room_name")
            or item.get("building_name")
        ),

        "title_th": name_th,
        "title_en": name_en,

        "code": item.get("code"),

        "building_id": building_id,
        "building_code": building_code,

        "room_number": item.get("room_number"),

        "type": item.get("type"),
        "course_code": item.get("course_code"),
        "organizer": item.get("organizer"),
        "start_at": item.get("start_at"),
        "end_at": item.get("end_at"),
        "time_zone": item.get("time_zone"),
        "recurrence_rule": item.get("recurrence_rule"),
        "room_id": item.get("room_id"),
        "status": item.get("status"),

        "facility_type": (
            item.get("type")
            if entity_type == "FACILITY"
            else None
        ),

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
    """Convert a DynamoDB Stream image to a search document."""
    item = deserialize_item(image)
    return to_search_document(item)


def get_deleted_document_id(
    keys: dict[str, Any],
) -> str:
    """Get the document ID from Stream keys."""
    item = deserialize_item(keys)
    return get_document_id(item)
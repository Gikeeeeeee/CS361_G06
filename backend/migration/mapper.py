from typing import Any

from models.schedule import to_utc


class MigrationError(ValueError):
    pass


def _required(value: Any, field: str, entity_id: Any) -> Any:
    if value is None or value == "":
        raise MigrationError(f"{field} is required for {entity_id}")
    return value


def map_building(building: dict[str, Any]) -> dict[str, Any]:
    code = str(_required(building.get("code"), "building.code", building.get("id"))).upper()
    return {
        **{k: v for k, v in building.items() if k not in {"floors"}},
        "PK": f"BUILDING#{code}", "SK": f"BUILDING#{code}",
        "GSI0PK": "BUILDING", "GSI0SK": code,
    }


def map_floor(building: dict[str, Any], floor: dict[str, Any]) -> dict[str, Any]:
    code = str(building["code"]).upper()
    floor_id = _required(floor.get("id"), "floor.id", code)
    number = _required(floor.get("floor_number"), "floor.floor_number", floor_id)
    return {
        **{k: v for k, v in floor.items() if k not in {"rooms", "facilities"}},
        "building_id": building["id"],
        "PK": f"BUILDING#{code}", "SK": f"FLOOR#{number}",
        "GSI0PK": "FLOOR", "GSI0SK": f"{code}#{number}",
        "GSI1PK": f"BUILDING#{building['id']}",
        "GSI1SK": f"FLOOR#{number}#{floor_id}",
    }


def map_room(floor: dict[str, Any], room: dict[str, Any], building_id: Any = None) -> dict[str, Any]:
    room_id = _required(room.get("id"), "room.id", room.get("room_number"))
    # Some valid V1 rooms are unnamed. Use their stable domain ID only in
    # storage keys; keep the nullable room_number field unchanged.
    key_part = str(room.get("room_number") or room_id).upper()
    return {
        **room,
        "building_id": building_id,
        "floor_id": floor["id"],
        "PK": f"FLOOR#{floor['id']}", "SK": f"ROOM#{key_part}",
        "GSI0PK": "ROOM", "GSI0SK": key_part,
        "GSI2PK": f"FLOOR#{floor['id']}",
        "GSI2SK": f"ROOM#{key_part}#{room_id}",
    }


def map_facility(building: dict[str, Any], floor: dict[str, Any], facility: dict[str, Any]) -> dict[str, Any]:
    facility_id = _required(facility.get("id"), "facility.id", facility)
    kind = str(_required(facility.get("type"), "facility.type", facility_id)).upper()
    key = f"FACILITY#{kind}#{facility_id}"
    return {
        **facility,
        "building_id": building["id"], "floor_id": floor["id"],
        "PK": f"FLOOR#{floor['id']}", "SK": key,
        "GSI0PK": "FACILITY", "GSI0SK": f"{kind}#{facility_id}",
        "GSI3PK": f"FLOOR#{floor['id']}", "GSI3SK": key,
    }


def map_schedule(schedule: dict[str, Any]) -> dict[str, Any]:
    schedule_id = _required(schedule.get("id"), "schedule.id", schedule)
    room_id = _required(schedule.get("room_id"), "schedule.room_id", schedule_id)
    start = _required(schedule.get("start_at"), "schedule.start_at", schedule_id)
    sort = f"{to_utc(start)}#SCHEDULE#{schedule_id}"
    item = {**schedule, "PK": f"ROOM#{room_id}", "SK": f"SCHEDULE#{schedule_id}",
            "GSI0PK": "SCHEDULE", "GSI0SK": schedule_id,
            "GSI4PK": f"ROOM#{room_id}", "GSI4SK": sort,
            "GSI6PK": f"TYPE#{schedule['type']}", "GSI6SK": sort}
    if schedule.get("course_code"):
        item.update(GSI5PK=f"COURSE#{schedule['course_code']}", GSI5SK=sort)
    return {k: v for k, v in item.items() if v is not None}

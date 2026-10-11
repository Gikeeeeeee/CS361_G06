from collections import Counter
from typing import Any


def validate(items: list[dict[str, Any]], schedules: list[dict[str, Any]] = None) -> list[str]:
    schedules = schedules or []
    errors = []
    for entity in ("BUILDING", "FLOOR", "ROOM", "FACILITY", "SCHEDULE"):
        ids = [str(i["id"]) for i in items if i.get("GSI0PK") == entity and i.get("id")]
        errors.extend(f"duplicate {entity.lower()} id: {value}" for value, count in Counter(ids).items() if count > 1)
    keys = [(i.get("PK"), i.get("SK")) for i in items]
    errors.extend(f"duplicate DynamoDB key: {key}" for key, count in Counter(keys).items() if count > 1)
    room_ids = {str(i["id"]) for i in items if i.get("GSI0PK") == "ROOM" and i.get("id")}
    building_ids = {str(i["id"]) for i in items if i.get("GSI0PK") == "BUILDING" and i.get("id")}
    floor_ids = {str(i["id"]) for i in items if i.get("GSI0PK") == "FLOOR" and i.get("id")}
    errors.extend(f"floor {i.get('id')} references missing building {i.get('building_id')}" for i in items if i.get("GSI0PK") == "FLOOR" and str(i.get("building_id")) not in building_ids)
    errors.extend(f"room {i.get('id')} references missing floor {i.get('floor_id')}" for i in items if i.get("GSI0PK") == "ROOM" and str(i.get("floor_id")) not in floor_ids)
    errors.extend(f"facility {i.get('id')} references missing floor {i.get('floor_id')}" for i in items if i.get("GSI0PK") == "FACILITY" and str(i.get("floor_id")) not in floor_ids)
    errors.extend(f"schedule {s.get('id')} references missing room {s.get('room_id')}" for s in schedules if str(s.get("room_id")) not in room_ids)
    return errors

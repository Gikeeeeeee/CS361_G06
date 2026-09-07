"""
Manual smoke check -- runs all five endpoints locally with fake data.

This is NOT the unit test suite (that is tracked separately on #43). It is a
throwaway sanity check you can run before deploying, with no AWS credentials
and no network:

    cd backend
    python smoke_local.py

Excluded from the Lambda package by terraform/main.tf.
"""

import json

import handler

BUILDING = {
    "id": "lc4",
    "name": "LC4",
    "latitude": 14.072606976041664,
    "longitude": 100.60772614298118,
    "floors": [
        {
            "id": "lc4-floor-1",
            "floor_number": 1,
            "rooms": [
                {"id": "room-lab102", "room_number": None, "name": "LAB102",
                 "type": "LAB"}
            ],
            "facilities": [
                {"id": "facility-stair1", "name": "Stair 1", "type": "STAIR"}
            ],
        }
    ],
}

INDEX = [
    {"id": "lc4", "name": "LC4", "latitude": 14.0726, "longitude": 100.6077}
]


class FakeSource:
    """In-memory stand-in for BuildingRepository (implements BuildingSource)."""

    def list_buildings(self):
        return INDEX

    def get_building(self, building_id):
        return BUILDING if str(building_id).upper() == "LC4" else None

    def presigned_url(self, key, expires_in=3600):
        return f"https://example.invalid/{key}"


def event(method, path, params=None, route_key=None):
    return {
        "version": "2.0",
        "routeKey": route_key,
        "rawPath": path,
        "pathParameters": params or {},
        "requestContext": {"http": {"method": method, "path": path}},
    }


B = "/api/v1/buildings"

# Route keys, exactly as API Gateway sends them (see terraform/main.tf).
RK_LIST = f"GET {B}"
RK_BUILDING = f"GET {B}/{{buildingId}}"
RK_FLOOR = f"GET {B}/{{buildingId}}/floors/{{floorId}}"
RK_ROOM = f"{RK_FLOOR}/rooms/{{roomId}}"
RK_FACILITY = f"{RK_FLOOR}/facilities/{{facilityId}}"

# name, method, path, pathParameters, routeKey, expected status
CHECKS = [
    ("list buildings", "GET", B, {}, RK_LIST, 200),
    ("building detail", "GET", f"{B}/LC4",
     {"buildingId": "LC4"}, RK_BUILDING, 200),
    ("building lowercase", "GET", f"{B}/lc4",
     {"buildingId": "lc4"}, RK_BUILDING, 200),
    ("building unknown", "GET", f"{B}/LC9",
     {"buildingId": "LC9"}, RK_BUILDING, 404),
    ("floor by number", "GET", f"{B}/LC4/floors/1",
     {"buildingId": "LC4", "floorId": "1"}, RK_FLOOR, 200),
    ("floor by uuid", "GET", f"{B}/LC4/floors/lc4-floor-1",
     {"buildingId": "LC4", "floorId": "lc4-floor-1"}, RK_FLOOR, 200),
    ("floor unknown", "GET", f"{B}/LC4/floors/99",
     {"buildingId": "LC4", "floorId": "99"}, RK_FLOOR, 404),
    ("room detail", "GET", f"{B}/LC4/floors/1/rooms/room-lab102",
     {"buildingId": "LC4", "floorId": "1", "roomId": "room-lab102"},
     RK_ROOM, 200),
    ("room unknown", "GET", f"{B}/LC4/floors/1/rooms/nope",
     {"buildingId": "LC4", "floorId": "1", "roomId": "nope"}, RK_ROOM, 404),
    ("room missing param", "GET", f"{B}/LC4/floors/1/rooms/",
     {"buildingId": "LC4", "floorId": "1"}, RK_ROOM, 400),
    ("facility detail", "GET", f"{B}/LC4/floors/1/facilities/facility-stair1",
     {"buildingId": "LC4", "floorId": "1", "facilityId": "facility-stair1"},
     RK_FACILITY, 200),
    ("facility unknown", "GET", f"{B}/LC4/floors/1/facilities/nope",
     {"buildingId": "LC4", "floorId": "1", "facilityId": "nope"},
     RK_FACILITY, 404),
    ("cors preflight", "OPTIONS", f"{B}/LC4", {}, None, 204),
    ("unknown route", "GET", "/api/v1/health", {}, None, 404),
    # no routeKey: exercises the path-matching fallback
    ("fallback (no routeKey)", "GET", f"{B}/LC4/floors/1/rooms/room-lab102",
     {}, None, 200),
]


def main():
    handler.DEPS = handler.Dependencies(FakeSource())

    failures = 0

    for name, method, path, params, route_key, expected in CHECKS:
        result = handler.lambda_handler(
            event(method, path, params, route_key), None
        )
        status = result["statusCode"]
        mark = "ok  " if status == expected else "FAIL"

        if status != expected:
            failures += 1

        body = result["body"]
        preview = body if len(body) < 90 else body[:87] + "..."

        print(f"[{mark}] {status} (want {expected})  {name:20} {preview}")

    print()
    print("all checks passed" if not failures else f"{failures} check(s) FAILED")


if __name__ == "__main__":
    main()

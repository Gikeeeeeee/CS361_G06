import json

import pytest

from tests.conftest import make_apigw_event

PATH = "/api/v1/rooms/room-uuid-1/schedules"
GET_KEY = "GET /api/v1/rooms/{roomId}/schedules"
POST_KEY = "POST /api/v1/rooms/{roomId}/schedules"
ITEM_KEY = "/api/v1/rooms/{roomId}/schedules/{scheduleId}"
SCHEDULE_ID = "550e8400-e29b-41d4-a716-446655440050"

WINDOW = {"start": "2026-09-16T00:00:00+07:00", "end": "2026-09-17T00:00:00+07:00"}
ALL_PATH = "/api/v1/schedules"
ALL_KEY = "GET /api/v1/schedules"

BODY = {
    "type": "ACTIVITY",
    "title": "Club meeting",
    "start_at": "2026-09-17T09:00:00+07:00",
    "end_at": "2026-09-17T11:00:00+07:00",
    "time_zone": "Asia/Bangkok",
    "status": "CONFIRM",
}


def _get(query=None, **event_kwargs):
    return make_apigw_event(
        method="GET",
        path=PATH,
        route_key=GET_KEY,
        path_parameters={"roomId": "room-uuid-1"},
        query=WINDOW if query is None else query,
        **event_kwargs,
    )


def _post(body=None):
    return make_apigw_event(
        method="POST",
        path=PATH,
        route_key=POST_KEY,
        path_parameters={"roomId": "room-uuid-1"},
        body=BODY if body is None else body,
    )


def _get_all(query=None):
    return make_apigw_event(
        method="GET", path=ALL_PATH, route_key=ALL_KEY, query=query
    )


# -- GET ---------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.handler
def test_get_all_schedules_uses_default_page_size(invoke_handler):
    result = invoke_handler(_get_all())

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["meta"] == {"count": 1, "next_token": None}
    assert len(body["data"]) == 1


@pytest.mark.unit
@pytest.mark.handler
@pytest.mark.parametrize("query", [{"pageSize": "abc"}, {"pageSize": "101"}])
def test_get_all_schedules_rejects_invalid_page_size(invoke_handler, query):
    result = invoke_handler(_get_all(query))

    assert result["statusCode"] == 400
    assert json.loads(result["body"])["error"]["code"] == "INVALID_PARAMETER"


@pytest.mark.unit
@pytest.mark.handler
def test_get_all_schedules_rejects_invalid_next_token(invoke_handler):
    result = invoke_handler(_get_all({"nextToken": "bad-token"}))

    assert result["statusCode"] == 400
    assert json.loads(result["body"])["error"]["code"] == "INVALID_PARAMETER"


@pytest.mark.unit
@pytest.mark.handler
def test_get_schedules_success(invoke_handler):
    result = invoke_handler(_get())

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["data"][0]["title"] == "Software Engineering"
    assert body["meta"] == {"room_id": "room-uuid-1", "type": None, "count": 1}


@pytest.mark.unit
@pytest.mark.handler
def test_get_schedules_passes_the_type_filter_through(invoke_handler):
    result = invoke_handler(_get(query={**WINDOW, "type": "EXAM"}))

    assert result["statusCode"] == 200
    assert json.loads(result["body"]) == {
        "data": [],
        "meta": {"room_id": "room-uuid-1", "type": "EXAM", "count": 0},
    }


@pytest.mark.unit
@pytest.mark.handler
def test_get_schedules_requires_the_window(invoke_handler):
    result = invoke_handler(_get(query={"start": WINDOW["start"]}))

    assert result["statusCode"] == 400
    body = json.loads(result["body"])
    assert body["error"]["code"] == "MISSING_PARAMETER"
    assert "end" in body["error"]["message"]


@pytest.mark.unit
@pytest.mark.handler
def test_get_schedules_route_falls_back_to_path_matching(invoke_handler):
    """No routeKey (direct invoke / REST payload): the regex has to win."""
    event = _get()
    del event["routeKey"]
    del event["pathParameters"]

    result = invoke_handler(event)

    assert result["statusCode"] == 200
    assert json.loads(result["body"])["data"]


@pytest.mark.unit
@pytest.mark.handler
def test_room_route_still_matches_without_the_schedules_suffix(invoke_handler):
    """Adding a child route must not swallow GET /api/v1/rooms/{roomId}."""
    event = make_apigw_event(method="GET", path="/api/v1/rooms/room-uuid-1")
    del event["routeKey"]

    result = invoke_handler(event)

    assert result["statusCode"] == 200
    assert json.loads(result["body"])["room_number"] == "101"


# -- POST --------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.handler
def test_post_schedule_returns_201_created(invoke_handler, schedule_source):
    result = invoke_handler(_post())

    assert result["statusCode"] == 201
    assert json.loads(result["body"]) == "created"
    assert len(schedule_source.schedules) == 2


@pytest.mark.unit
@pytest.mark.handler
def test_post_schedule_conflict_returns_409(invoke_handler):
    result = invoke_handler(
        _post(
            {
                **BODY,
                "start_at": "2026-09-16T15:00:00+07:00",
                "end_at": "2026-09-16T17:00:00+07:00",
            }
        )
    )

    assert result["statusCode"] == 409
    body = json.loads(result["body"])
    assert body["error"]["code"] == "SCHEDULE_CONFLICT"
    assert "room-uuid-1" in body["error"]["message"]


@pytest.mark.unit
@pytest.mark.handler
def test_post_schedule_invalid_payload_returns_400(invoke_handler):
    result = invoke_handler(_post({"type": "ACTIVITY"}))

    assert result["statusCode"] == 400
    assert json.loads(result["body"])["error"]["code"] == "MISSING_PARAMETER"


@pytest.mark.unit
@pytest.mark.handler
def test_post_schedule_malformed_json_returns_400(invoke_handler):
    result = invoke_handler(_post("{not json"))

    assert result["statusCode"] == 400
    body = json.loads(result["body"])
    assert body["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.unit
@pytest.mark.handler
def test_post_schedule_empty_body_returns_400(invoke_handler):
    result = invoke_handler(_post({}))

    assert result["statusCode"] == 400
    assert json.loads(result["body"])["error"]["code"] == "MISSING_PARAMETER"


# -- PUT / DELETE ------------------------------------------------------------


def _item(method, body=None):
    return make_apigw_event(
        method=method,
        path=f"{PATH}/{SCHEDULE_ID}",
        route_key=f"{method} {ITEM_KEY}",
        path_parameters={"roomId": "room-uuid-1", "scheduleId": SCHEDULE_ID},
        body=body,
    )


@pytest.mark.unit
@pytest.mark.handler
def test_put_schedule_returns_updated(invoke_handler, schedule_source):
    result = invoke_handler(_item("PUT", {**BODY, "title": "Renamed"}))

    assert result["statusCode"] == 200
    assert json.loads(result["body"]) == "updated"
    assert schedule_source.schedules[0]["title"] == "Renamed"


@pytest.mark.unit
@pytest.mark.handler
def test_put_schedule_unknown_id_returns_404(invoke_handler):
    event = _item("PUT", BODY)
    event["pathParameters"]["scheduleId"] = "nope"

    result = invoke_handler(event)

    assert result["statusCode"] == 404
    assert json.loads(result["body"])["error"]["code"] == "SCHEDULE_NOT_FOUND"


@pytest.mark.unit
@pytest.mark.handler
def test_delete_schedule_returns_deleted(invoke_handler, schedule_source):
    result = invoke_handler(_item("DELETE"))

    assert result["statusCode"] == 200
    assert json.loads(result["body"]) == "deleted"
    assert schedule_source.schedules == []


# -- POST /api/v1/schedules/imports --------------------------------------------

IMPORT_KEY = "POST /api/v1/schedules/imports"
CSV = (
    "building,room,type,title,start_at,end_at,course_code,organizer,recurrence_rule\n"
    "LC4,201,COURSE,CS361,2026-10-05T09:00:00+07:00,2026-10-05T12:00:00+07:00,CS361,Dr. A,\n"
)


def _import(body=CSV, query=None, base64_encoded=False):
    event = make_apigw_event(
        method="POST", path="/api/v1/schedules/imports", route_key=IMPORT_KEY,
        query=query, body=body,
    )
    event["isBase64Encoded"] = base64_encoded
    return event


@pytest.mark.unit
@pytest.mark.handler
def test_import_dry_run_reads_the_raw_csv(invoke_handler):
    result = invoke_handler(_import(query={"dry_run": "true"}))

    assert result["statusCode"] == 200
    assert json.loads(result["body"])["rows"][0]["room"] == "201"


@pytest.mark.unit
@pytest.mark.handler
@pytest.mark.parametrize("query", [None, {"dry_run": "false"}])
def test_import_without_dry_run_creates(invoke_handler, query):
    import base64

    event = _import(base64.b64encode(CSV.encode()).decode(), query, base64_encoded=True)
    result = invoke_handler(event)

    assert result["statusCode"] == 201
    assert json.loads(result["body"]) == {"created": 1}


@pytest.mark.unit
@pytest.mark.handler
def test_import_row_errors_carry_details(invoke_handler):
    result = invoke_handler(_import(CSV.replace("COURSE", "PARTY")))

    assert result["statusCode"] == 400
    error = json.loads(result["body"])["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["details"][0]["row"] == 2


@pytest.mark.unit
@pytest.mark.handler
def test_import_file_errors_have_no_details(invoke_handler):
    result = invoke_handler(_import("building,room\n"))

    assert result["statusCode"] == 400
    assert "details" not in json.loads(result["body"])["error"]

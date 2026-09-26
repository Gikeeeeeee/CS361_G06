import json

import pytest

from tests.conftest import make_apigw_event

PATH = "/api/v1/rooms/room-uuid-1/schedules"
GET_KEY = "GET /api/v1/rooms/{roomId}/schedules"
POST_KEY = "POST /api/v1/rooms/{roomId}/schedules"

WINDOW = {"start": "2026-09-16T00:00:00+07:00", "end": "2026-09-17T00:00:00+07:00"}

BODY = {
    "type": "ACTIVITY",
    "title": "Club meeting",
    "start_at": "2026-09-17T09:00:00+07:00",
    "end_at": "2026-09-17T11:00:00+07:00",
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


# -- GET ---------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.handler
def test_get_schedules_success(invoke_handler):
    result = invoke_handler(_get())

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["schedules"][0]["title"] == "Software Engineering"
    assert "meta" not in body


@pytest.mark.unit
@pytest.mark.handler
def test_get_schedules_passes_the_type_filter_through(invoke_handler):
    result = invoke_handler(_get(query={**WINDOW, "type": "EXAM"}))

    assert result["statusCode"] == 200
    assert json.loads(result["body"]) == {"schedules": []}


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
    assert json.loads(result["body"])["schedules"]


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

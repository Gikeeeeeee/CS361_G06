import json

from handler import lambda_handler, Dependencies
from errors import UpstreamError


def make_event():
    return {
        "version": "2.0",
        "routeKey": "GET /api/v1/buildings",
        "rawPath": "/api/v1/buildings",
        "requestContext": {
            "http": {
                "method": "GET"
            }
        }
    }


class FakeBuildingSource:

    def __init__(self, buildings=None, error=None):
        self.buildings = buildings
        self.error = error

    def list_buildings(self):
        if self.error:
            raise self.error
        return self.buildings

    def get_building(self, building_id):
        return None

    def presigned_url(self, key, expires_in=3600):
        return "fake-url"


def invoke_api(buildings=None, error=None):
    source = FakeBuildingSource(buildings, error)
    deps = Dependencies(source)

    import handler

    original_deps = handler.DEPS
    handler.DEPS = deps

    try:
        return lambda_handler(make_event(), None)
    finally:
        handler.DEPS = original_deps


# =========================================================
# Positive Tests
# =========================================================

def test_get_buildings_success():
    buildings = [
        {
            "id": "lc3",
            "code": "LC3",
            "name": {
                "th": "อาคาร LC3",
                "en": "LC3 Building"
            },
            "image_key": "image/building/LC3.webp",
            "latitude": 14.072603828706107,
            "longitude": 100.60628435011894
        },
        {
            "id": "lc4",
            "code": "LC4",
            "name": {
                "th": "อาคาร LC4",
                "en": "LC4 Building"
            },
            "image_key": "image/building/LC4.webp",
            "latitude": 14.072606976041664,
            "longitude": 100.60772614298118
        }
    ]

    result = invoke_api(buildings)

    assert result["statusCode"] == 200

    body = json.loads(result["body"])

    assert body["buildings"] == buildings


def test_get_buildings_single_building():
    buildings = [
        {
            "id": "lc3",
            "code": "LC3",
            "name": {
                "th": "อาคาร LC3",
                "en": "LC3 Building"
            },
            "image_key": "image/building/LC3.webp",
            "latitude": 14.072603828706107,
            "longitude": 100.60628435011894
        }
    ]

    result = invoke_api(buildings)

    assert result["statusCode"] == 200

    body = json.loads(result["body"])

    assert len(body["buildings"]) == 1
    assert body["buildings"][0]["id"] == "lc3"


def test_get_buildings_multiple_buildings():
    buildings = [
        {"id": "lc1"},
        {"id": "lc2"},
        {"id": "lc3"},
        {"id": "lc4"},
        {"id": "lc5"},
    ]

    result = invoke_api(buildings)

    assert result["statusCode"] == 200

    body = json.loads(result["body"])

    assert len(body["buildings"]) == 5


# =========================================================
# Negative Tests
# =========================================================

def test_get_buildings_empty_list():
    result = invoke_api([])

    assert result["statusCode"] == 200

    body = json.loads(result["body"])

    assert body["buildings"] == []


# TC05: Building data source error
def test_get_buildings_data_source_error():
    result = invoke_api(
        error=UpstreamError("Building data source is unavailable")
    )

    assert result["statusCode"] == 502

"""Exercise smoke verification through a fake HTTP opener; never call AWS."""

import io
import json
from pathlib import Path
import runpy
import socket
import subprocess
import sys
from urllib.error import HTTPError, URLError
import urllib.request

import pytest

from scripts import smoke_test as smoke


API = "https://api.example.test/stage"
CDN = "https://assets.example.test"
CODE = "EXAMPLE-BUILDING"
KEY = "floor-plan/EXAMPLE-BUILDING/level-two.svg"
SVG = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">\n<path d="M0 0 L1 1"/>\n</svg>'


class Response(io.BytesIO):
    def __init__(self, body, media_type, status=200):
        super().__init__(body)
        self.status = status
        self.headers = {"Content-Type": media_type}

    def getcode(self):
        return self.status


class Opener:
    def __init__(self, routes):
        self.routes = routes
        self.calls = []

    def open(self, request, timeout):
        self.calls.append(request)
        assert request.get_method() == "GET"
        assert request.get_header("Authorization") is None
        assert timeout > 0
        result = self.routes[request.full_url]
        if isinstance(result, Exception):
            raise result
        body, media_type, status = result
        if not isinstance(body, bytes):
            body = json.dumps(body).encode()
        return Response(body, media_type, status)


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def blocked(*args, **kwargs):
        pytest.fail("A unit test attempted an external network connection")
    monkeypatch.setattr(socket, "create_connection", blocked)


@pytest.fixture
def scenario(tmp_path):
    (tmp_path / "building").mkdir()
    (tmp_path / KEY).parent.mkdir(parents=True)
    (tmp_path / KEY).write_bytes(SVG)
    (tmp_path / "building" / "metadata.json").write_text(json.dumps({
        "code": CODE, "floors": [{"id": "source-floor-id", "floor_number": 2, "floor_plan_key": KEY}],
    }))
    pin = {"id": "room-id", "room_number": "R", "name": {"th": None, "en": "Room"}, "type": "CLASSROOM", "latitude": 1.0, "longitude": 2.0}
    floor = {"id": "discovered-floor-id", "floor_number": 2, "floor_plan": {"type": "svg", "url": CDN + "/" + KEY}, "rooms": [pin], "facilities": []}
    routes = {
        API + "/api/v1/buildings": ({"buildings": [{"id": "building-id", "code": CODE}]}, "application/json", 200),
        API + "/api/v1/buildings/" + CODE: ({"id": "building-id", "code": CODE, "floors": [{"id": floor["id"], "floor_number": 2}]}, "application/json", 200),
        API + "/api/v1/floors/" + floor["id"]: (floor, "application/json", 200),
        CDN + "/" + KEY: (SVG, "image/svg+xml; charset=utf-8", 200),
    }
    opener = Opener(routes)
    return tmp_path, routes, floor, opener, smoke.HttpClient(opener=opener)


def execute(scenario, **kwargs):
    path, _, _, _, client = scenario
    return smoke.run_smoke(API, CDN, path, client=client, **kwargs)


def test_success_discovers_ids_instead_of_requiring_fixed_data(scenario, capsys):
    path, _, _, opener, client = scenario
    assert smoke.main(["--api-base-url", API, "--asset-base-url", CDN, "--assets-dir", str(path)], client=client) == 0
    assert len(opener.calls) == 4
    assert "one representative pair" in capsys.readouterr().out


@pytest.mark.parametrize("which,status", [("api", 503), ("api", 404), ("asset", 403), ("asset", 302)])
def test_non_200_fails(scenario, which, status):
    _, routes, _, _, _ = scenario
    url = API + "/api/v1/buildings" if which == "api" else CDN + "/" + KEY
    body, media_type, _ = routes[url]
    routes[url] = body, media_type, status
    with pytest.raises(smoke.SmokeError) as error:
        execute(scenario)
    assert error.value.category == ("API_UNAVAILABLE" if which == "api" else "ASSET_INACCESSIBLE")


@pytest.mark.parametrize("body", [b"not json", b"[]", b"null", b'{"error":{"message":"failed"}}', b'{"buildings":NaN}'])
def test_invalid_json_or_error_payload_fails(scenario, body):
    scenario[1][API + "/api/v1/buildings"] = body, "application/json", 200
    with pytest.raises(smoke.SmokeError, match="JSON|error payload"):
        execute(scenario)


@pytest.mark.parametrize("missing", ["id", "floor_number", "floor_plan", "rooms", "facilities"])
def test_missing_floor_fields_fail(scenario, missing):
    del scenario[2][missing]
    with pytest.raises(smoke.SmokeError):
        execute(scenario)


def test_missing_index_fields_fail(scenario):
    scenario[1][API + "/api/v1/buildings"][0]["buildings"][0].pop("code")
    with pytest.raises(smoke.SmokeError, match="id and code"):
        execute(scenario)


@pytest.mark.parametrize("field,value", [("id", "wrong-floor"), ("floor_number", 3), ("floor_number", True)])
def test_incorrect_floor_association_fails(scenario, field, value):
    scenario[2][field] = value
    with pytest.raises(smoke.SmokeError):
        execute(scenario)


def test_incorrect_building_association_fails(scenario):
    scenario[1][API + "/api/v1/buildings/" + CODE][0]["code"] = "OTHER"
    with pytest.raises(smoke.SmokeError, match="does not match discovery"):
        execute(scenario)


@pytest.mark.parametrize("url", [None, "", "http://assets.example.test/wrong.svg", "file:///secret", "https://other.example.test/" + KEY, CDN + "/floor-plan/OTHER/other.svg", CDN + "/" + KEY + "#fragment"])
def test_missing_malformed_or_wrong_svg_reference_fails(scenario, url):
    scenario[2]["floor_plan"]["url"] = url
    with pytest.raises(smoke.SmokeError) as error:
        execute(scenario)
    assert error.value.category == "INCORRECT_REFERENCE"


@pytest.mark.parametrize("body,media", [(b"<html/>", "text/html"), (b"<html/>", "image/svg+xml"), (b"<svg", "image/svg+xml"), (b'<svg xmlns="http://www.w3.org/2000/svg"><!broken></svg>', "image/svg+xml"), (b'<!DOCTYPE svg [<!ENTITY x "value">]><svg/>', "image/svg+xml"), (b'<?xml version="1.0" encoding="not-a-real-encoding"?><svg/>', "image/svg+xml")])
def test_invalid_svg_fails(scenario, body, media):
    scenario[1][CDN + "/" + KEY] = body, media, 200
    with pytest.raises(smoke.SmokeError) as error:
        execute(scenario)
    assert error.value.category == "MALFORMED_ASSET"


def test_valid_but_different_svg_flags_potential_staleness(scenario):
    scenario[1][CDN + "/" + KEY] = SVG.replace(b"L1 1", b"L2 2"), "image/svg+xml", 200
    with pytest.raises(smoke.SmokeError, match="potentially stale") as error:
        execute(scenario)
    assert error.value.category == "ASSET_MISMATCH"
    assert "Historical age cannot be inferred" in str(error.value)


def test_svg_line_endings_do_not_cause_false_staleness(scenario):
    scenario[1][CDN + "/" + KEY] = SVG.replace(b"\n", b"\r\n"), "image/svg+xml", 200
    execute(scenario)


@pytest.mark.parametrize("exception", [TimeoutError("private details"), URLError("private details"), ConnectionError("private details")])
@pytest.mark.parametrize("asset", [False, True])
def test_timeout_or_connection_failure_is_classified(scenario, exception, asset):
    scenario[1][CDN + "/" + KEY if asset else API + "/api/v1/buildings"] = exception
    with pytest.raises(smoke.SmokeError) as error:
        execute(scenario)
    assert error.value.category == ("ASSET_INACCESSIBLE" if asset else "API_UNAVAILABLE")
    assert "private details" not in str(error.value)


@pytest.mark.parametrize("failure", [False, True])
def test_signed_urls_never_appear_in_logs(scenario, failure, capsys):
    path, routes, floor, _, client = scenario
    signed = floor["floor_plan"]["url"] + "?X-Amz-Signature=PRIVATE_SIGNATURE&X-Amz-Security-Token=PRIVATE_TOKEN"
    floor["floor_plan"]["url"] = signed
    routes[signed] = HTTPError(signed, 403, signed, {}, None) if failure else routes[CDN + "/" + KEY]
    result = smoke.main(["--api-base-url", API, "--asset-base-url", CDN, "--assets-dir", str(path)], client=client)
    assert result == (1 if failure else 0)
    output = capsys.readouterr()
    assert all(value not in output.out + output.err for value in ("PRIVATE_SIGNATURE", "PRIVATE_TOKEN", "X-Amz-", signed))


def test_missing_baseline_is_explicitly_unverifiable(scenario):
    (scenario[0] / KEY).unlink()
    with pytest.raises(smoke.SmokeError) as error:
        execute(scenario)
    assert error.value.category == "BASELINE_UNAVAILABLE"


def test_explicit_selection_must_exist_in_discovery(scenario):
    execute(scenario, building_code=CODE.lower(), floor_number=2)
    with pytest.raises(smoke.SmokeError):
        execute(scenario, building_code="absent")
    with pytest.raises(smoke.SmokeError):
        execute(scenario, building_code=CODE, floor_number=999)


def test_bad_pin_schema_fails(scenario):
    scenario[2]["rooms"][0].pop("latitude")
    with pytest.raises(smoke.SmokeError, match="pin"):
        execute(scenario)


def test_oversized_body_fails(scenario, monkeypatch):
    monkeypatch.setattr(smoke, "MAX_RESPONSE_BYTES", 1)
    with pytest.raises(smoke.SmokeError, match="size limit"):
        execute(scenario)


def test_redirect_handler_does_not_follow_signed_url():
    assert smoke.NoRedirect().redirect_request(None, None, 302, "", {}, "https://other.example.test/?secret=value") is None


def test_cli_configuration_error_has_nonzero_process_exit_without_url_leak():
    signed = "https://api.example.test/?secret=PRIVATE_TOKEN"
    result = subprocess.run([sys.executable, str(Path(smoke.__file__)), "--api-base-url", signed, "--asset-base-url", CDN], capture_output=True, text=True)
    assert result.returncode == 2
    assert "CONFIGURATION" in result.stderr
    assert "PRIVATE_TOKEN" not in result.stderr + result.stdout


def test_invalid_cli_arguments_are_redacted(capsys):
    assert smoke.main(["--unknown=PRIVATE_TOKEN"]) == 2
    assert "PRIVATE_TOKEN" not in capsys.readouterr().err


@pytest.mark.parametrize("fail,expected", [(False, 0), (True, 1)])
def test_script_entry_point_exit_codes(scenario, monkeypatch, fail, expected):
    if fail:
        scenario[2]["id"] = "incorrect-floor"
    monkeypatch.setattr(urllib.request, "build_opener", lambda *_: scenario[3])
    monkeypatch.setattr(sys, "argv", [str(smoke.__file__), "--api-base-url", API, "--asset-base-url", CDN, "--assets-dir", str(scenario[0])])
    with pytest.raises(SystemExit) as exit_info:
        runpy.run_path(smoke.__file__, run_name="__main__")
    assert exit_info.value.code == expected


def test_discovery_skips_buildings_without_floors(scenario):
    _, routes, _, opener, _ = scenario
    routes[API + "/api/v1/buildings"][0]["buildings"].insert(0, {"id": "empty-building", "code": "EMPTY"})
    routes[API + "/api/v1/buildings/EMPTY"] = {"id": "empty-building", "code": "EMPTY", "floors": []}, "application/json", 200
    execute(scenario)
    assert len(opener.calls) == 5


def test_duplicate_floor_associations_fail(scenario):
    summary = scenario[1][API + "/api/v1/buildings/" + CODE][0]
    summary["floors"].append(dict(summary["floors"][0]))
    with pytest.raises(smoke.SmokeError, match="must be unique"):
        execute(scenario)


def test_json_body_with_wrong_content_type_fails(scenario):
    url = API + "/api/v1/buildings"
    body, _, status = scenario[1][url]
    scenario[1][url] = body, "text/html", status
    with pytest.raises(smoke.SmokeError, match="application/json"):
        execute(scenario)


def test_baseline_must_not_escape_checkout(scenario):
    path = scenario[0] / "building/metadata.json"
    data = json.loads(path.read_text())
    data["floors"][0]["floor_plan_key"] = "../../outside.svg"
    path.write_text(json.dumps(data))
    with pytest.raises(smoke.SmokeError) as error:
        execute(scenario)
    assert error.value.category == "BASELINE_UNAVAILABLE"


def test_cd_environment_configuration(scenario, monkeypatch):
    monkeypatch.setenv("API_BASE_URL", API)
    monkeypatch.setenv("ASSET_BASE_URL", CDN)
    assert smoke.main(["--assets-dir", str(scenario[0])], client=scenario[4]) == 0

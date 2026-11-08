"""Read-only deployment verification; no AWS SDK or third-party dependencies.

Run from any directory with API_BASE_URL and ASSET_BASE_URL set, or pass the
corresponding CLI options. The checkout's building-data is the asset baseline.
"""

import argparse
import hashlib
import http.client
import json
import math
import os
from pathlib import Path, PurePosixPath
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import xml.etree.ElementTree as ET


MAX_RESPONSE_BYTES = 8 * 1024 * 1024
SVG_TAG = "{http://www.w3.org/2000/svg}svg"


class SmokeError(Exception):
    def __init__(self, category, message):
        self.category = category
        super().__init__(message)


def reject_nonfinite_json(_):
    raise ValueError("Non-finite numbers are not JSON")


def require(condition, category, message):
    if not condition:
        raise SmokeError(category, message)


def https_url(value, *, base=False):
    """Validate without ever including the supplied URL in an error."""
    require(isinstance(value, str) and bool(value), "CONFIGURATION" if base else "INCORRECT_REFERENCE", "A nonempty HTTPS URL is required.")
    category = "CONFIGURATION" if base else "INCORRECT_REFERENCE"
    try:
        parts = urlsplit(value)
        valid = (
            parts.scheme == "https" and parts.hostname and not parts.username
            and not parts.password and not parts.fragment and not any(c.isspace() or ord(c) < 32 for c in value)
            and "\\" not in value and (not base or not parts.query)
        )
        _ = parts.port  # Reject malformed port numbers as well.
    except ValueError:
        valid = False
    require(valid, category, "URL must be HTTPS without credentials, fragments, whitespace or invalid ports; base URLs must not contain queries.")
    return parts


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Do not forward signed query strings to unexpected redirect targets.
        return None


class HttpClient:
    def __init__(self, timeout=10, opener=None):
        self.timeout = timeout
        self.opener = opener if opener is not None else build_opener(NoRedirect())

    def get(self, url, label, *, asset=False):
        category = "ASSET_INACCESSIBLE" if asset else "API_UNAVAILABLE"
        try:
            request = Request(url, method="GET", headers={"Accept": "image/svg+xml" if asset else "application/json"})
            with self.opener.open(request, timeout=self.timeout) as response:
                status = response.getcode()
                require(status == 200, category, f"{label}: expected HTTP 200; received {status if type(status) is int else 'invalid status'}.")
                body = response.read(MAX_RESPONSE_BYTES + 1)
                require(len(body) <= MAX_RESPONSE_BYTES, "MALFORMED_ASSET" if asset else "API_CONTRACT", f"{label}: response exceeds the size limit.")
                media_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
                return body, media_type
        except HTTPError as exc:
            raise SmokeError(category, f"{label}: HTTP {exc.code}; check deployment, routing and access.") from None
        except (URLError, TimeoutError, OSError, http.client.HTTPException):
            raise SmokeError(category, f"{label}: connection, timeout or transfer failure; check endpoint availability and access.") from None

    def get_json(self, url, label):
        body, media_type = self.get(url, label)
        require(media_type == "application/json", "API_CONTRACT", f"{label}: expected application/json.")
        try:
            value = json.loads(body, parse_constant=reject_nonfinite_json)
        except (ValueError, UnicodeError):
            raise SmokeError("API_CONTRACT", f"{label}: invalid JSON.") from None
        require(isinstance(value, dict), "API_CONTRACT", f"{label}: expected a JSON object.")
        require(value.get("success") is not False and "error" not in value, "API_CONTRACT", f"{label}: error payload returned with HTTP 200.")
        return value


def nonempty_string(value):
    return isinstance(value, str) and bool(value.strip())


def floor_metadata(value, label):
    require(isinstance(value, dict) and nonempty_string(value.get("id")), "API_CONTRACT", f"{label}: floor id is required.")
    require(type(value.get("floor_number")) is int, "API_CONTRACT", f"{label}: floor_number must be an integer.")
    return value


def validate_pins(floor):
    # Required pin fields/types from docs/contract/floor.json; tolerate extra
    # response fields so this smoke check does not prevent additive evolution.
    for collection in ("rooms", "facilities"):
        pins = floor.get(collection)
        require(isinstance(pins, list), "API_CONTRACT", "Floor detail: rooms and facilities arrays are required.")
        for pin in pins:
            valid = isinstance(pin, dict) and nonempty_string(pin.get("id")) and nonempty_string(pin.get("type"))
            name = pin.get("name") if isinstance(pin, dict) else None
            valid = valid and isinstance(name, dict) and all(k in name and (name[k] is None or isinstance(name[k], str)) for k in ("th", "en"))
            valid = valid and all(type(pin.get(k)) in (int, float) and math.isfinite(pin[k]) for k in ("latitude", "longitude"))
            if collection == "rooms":
                valid = valid and "room_number" in pin and (pin["room_number"] is None or isinstance(pin["room_number"], str))
            require(valid, "API_CONTRACT", "Floor detail: a room/facility pin is missing required fields or has invalid types.")


def baseline_for(assets_dir, building_code, floor_number):
    """Use deployment source metadata, never a guessed key or a fixed ID."""
    try:
        matches = []
        for path in sorted((assets_dir / "building").glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8-sig"))
            if isinstance(data, dict) and str(data.get("code", "")).casefold() == building_code.casefold():
                matches.extend(f for f in data.get("floors", []) if isinstance(f, dict) and type(f.get("floor_number")) is int and f["floor_number"] == floor_number)
        require(len(matches) == 1, "BASELINE_UNAVAILABLE", "Exactly one checkout metadata entry must match the discovered building/floor; association and freshness cannot otherwise be established.")
        key = matches[0].get("floor_plan_key")
        require(nonempty_string(key), "BASELINE_UNAVAILABLE", "Checkout floor metadata has no SVG key.")
        parts = PurePosixPath(key)
        require(bool(parts.parts) and not parts.is_absolute() and ".." not in parts.parts and "\\" not in key and parts.parts[0] == "floor-plan" and parts.suffix.lower() == ".svg", "BASELINE_UNAVAILABLE", "Checkout floor metadata has an invalid SVG key.")
        path = (assets_dir / key).resolve()
        require(path.is_relative_to(assets_dir.resolve()), "BASELINE_UNAVAILABLE", "Checkout SVG must remain inside the asset directory.")
        return key, path.read_bytes()
    except (OSError, ValueError, TypeError, AttributeError):
        raise SmokeError("BASELINE_UNAVAILABLE", "Cannot read valid building/floor metadata and SVG baseline from the checkout.") from None


def normalized_digest(body):
    # XML normalizes line endings; avoid false failures between Windows/Linux.
    return hashlib.sha256(body.replace(b"\r\n", b"\n").replace(b"\r", b"\n")).digest()


def verify_svg(url, asset_base, key, expected_body, client):
    parts = https_url(url)
    trusted = https_url(asset_base, base=True)
    expected_path = unquote(trusted.path.rstrip("/") + "/" + key)
    require((parts.hostname, parts.port or 443) == (trusted.hostname, trusted.port or 443) and unquote(parts.path) == expected_path, "INCORRECT_REFERENCE", "Floor SVG URL does not match the trusted asset origin and checkout building/floor key.")
    body, media_type = client.get(url, "floor SVG", asset=True)
    require(media_type == "image/svg+xml", "MALFORMED_ASSET", "Floor SVG: expected image/svg+xml, not an HTML or JSON response.")
    declarations = body.replace(b"\x00", b"").upper()
    require(b"<!DOCTYPE" not in declarations and b"<!ENTITY" not in declarations, "MALFORMED_ASSET", "Floor SVG: DTD/entity declarations are not accepted.")
    try:
        svg = ET.fromstring(body)
    except (ET.ParseError, ValueError, LookupError):
        raise SmokeError("MALFORMED_ASSET", "Floor SVG: invalid XML.") from None
    require(svg.tag == SVG_TAG, "MALFORMED_ASSET", "Floor SVG: XML root must be an SVG element in the SVG namespace.")
    require(normalized_digest(body) == normalized_digest(expected_body), "ASSET_MISMATCH", "Floor SVG differs from the trusted checkout baseline: wrong or potentially stale content. Historical age cannot be inferred.")


def run_smoke(api_base, asset_base, assets_dir, *, client=None, building_code=None, floor_number=None, timeout=10):
    https_url(api_base, base=True)
    https_url(asset_base, base=True)
    require(math.isfinite(timeout) and timeout > 0, "CONFIGURATION", "Timeout must be a positive finite number.")
    require(floor_number is None or building_code is not None, "CONFIGURATION", "An explicit floor selection also requires a building code.")
    client = client if client is not None else HttpClient(timeout)
    api = api_base.rstrip("/") + "/api/v1"
    index = client.get_json(api + "/buildings", "building discovery")
    buildings = index.get("buildings")
    require(isinstance(buildings, list) and bool(buildings), "API_CONTRACT", "Building discovery: a nonempty buildings array is required.")
    for item in buildings:
        require(isinstance(item, dict) and nonempty_string(item.get("id")) and nonempty_string(item.get("code")), "API_CONTRACT", "Building discovery: each building requires id and code.")
    candidates = sorted(buildings, key=lambda item: item["code"].casefold())
    if building_code is not None:
        candidates = [b for b in candidates if b["code"].casefold() == building_code.casefold()]
    require(bool(candidates), "CONFIGURATION", "Configured building is absent from discovery.")
    for selected in candidates:
        summary = client.get_json(api + "/buildings/" + quote(selected["code"], safe=""), "building summary")
        require(summary.get("id") == selected["id"] and summary.get("code") == selected["code"], "API_CONTRACT", "Building summary id/code does not match discovery.")
        floors = summary.get("floors")
        require(isinstance(floors, list), "API_CONTRACT", "Building summary: floors array is required.")
        floors = [floor_metadata(f, "building summary") for f in floors]
        require(len({f["id"] for f in floors}) == len(floors) and len({f["floor_number"] for f in floors}) == len(floors), "API_CONTRACT", "Building summary: floor ids and numbers must be unique.")
        if floor_number is not None:
            floors = [f for f in floors if f["floor_number"] == floor_number]
        if not floors:
            continue
        chosen = min(floors, key=lambda f: f["floor_number"])
        floor = client.get_json(api + "/floors/" + quote(chosen["id"], safe=""), "floor detail")
        floor_metadata(floor, "floor detail")
        require(floor["id"] == chosen["id"] and floor["floor_number"] == chosen["floor_number"], "API_CONTRACT", "Floor detail id/number does not match the selected building's floor.")
        validate_pins(floor)
        plan = floor.get("floor_plan")
        require(isinstance(plan, dict) and plan.get("type") == "svg" and nonempty_string(plan.get("url")), "INCORRECT_REFERENCE", "Floor detail requires floor_plan type svg and a nonempty URL.")
        key, expected = baseline_for(Path(assets_dir), selected["code"], chosen["floor_number"])
        verify_svg(plan["url"], asset_base, key, expected, client)
        return
    raise SmokeError("API_CONTRACT", "No discoverable building/floor pair matches the requested selection.")


class SafeParser(argparse.ArgumentParser):
    def error(self, message):
        # argparse messages may echo signed URLs supplied as invalid arguments.
        raise SmokeError("CONFIGURATION", "Invalid command-line arguments; use --help.")


def main(argv=None, *, client=None):
    try:
        parser = SafeParser(description=__doc__)
        parser.add_argument("--api-base-url", default=os.environ.get("API_BASE_URL"), help="Terraform api_endpoint output (without /api/v1).")
        parser.add_argument("--asset-base-url", default=os.environ.get("ASSET_BASE_URL"), help="Trusted Terraform cdn_url output.")
        parser.add_argument("--assets-dir", type=Path, default=Path(__file__).resolve().parents[1] / "building-data")
        parser.add_argument("--building-code", help="Optional discovery-validated representative building.")
        parser.add_argument("--floor-number", type=int, help="Optional discovery-validated floor, with --building-code.")
        parser.add_argument("--timeout", type=float, default=10)
        args = parser.parse_args(argv)
        run_smoke(args.api_base_url, args.asset_base_url, args.assets_dir, client=client, building_code=args.building_code, floor_number=args.floor_number, timeout=args.timeout)
    except SmokeError as exc:
        print(f"FAIL [{exc.category}]: {exc}", file=sys.stderr)
        return 2 if exc.category == "CONFIGURATION" else 1
    except Exception:
        # Never dump a traceback, URL, server payload or exception containing tokens.
        print("FAIL [CHECKER_ERROR]: unexpected verification error; inspect the local checker tests.", file=sys.stderr)
        return 1
    print("PASS: discovery, building, floor and SVG match the checkout baseline (one representative pair). Historical freshness is not established.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

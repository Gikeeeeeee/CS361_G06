"""Exercise the asset checker against isolated files, never repository assets."""
import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verify_svg_assets import verify


@pytest.fixture
def assets(tmp_path):
    files = {
        "building-data/floor-plan/B/f1.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
        "building-data/building/B.json": json.dumps({"floors": [{"floor_plan_key": "floor-plan/B/f1.svg"}]}),
        "frontend/public/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
        "frontend/index.html": '<link href="/logo.svg"/>',
        "frontend/dist/index.html": '<link href="/logo.svg"/>',
        "frontend/dist/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
    }
    for name, content in files.items():
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    return tmp_path


def test_valid_assets_and_build(assets):
    assert verify(assets, assets / "frontend/dist") == ([], 2)


@pytest.mark.parametrize("content, message", [
    ("<svg>", "Malformed SVG XML"),
    ("<html/>", "Non-SVG root"),
])
def test_invalid_svg(assets, content, message):
    (assets / "frontend/public/logo.svg").write_text(content)
    assert any(message in error for error in verify(assets)[0])


def test_case_sensitive_missing_and_stale_plans(assets):
    (assets / "building-data/building/B.json").write_text(json.dumps({
        "floors": [{"floor_plan_key": "floor-plan/B/F1.svg"}]}))
    errors, _ = verify(assets)
    assert any("Missing floor-plan asset" in error for error in errors)
    assert any("Unreferenced floor-plan asset" in error for error in errors)


def test_missing_public_reference(assets):
    (assets / "frontend/index.html").write_text('<link href="/missing.svg"/>')
    assert any("Missing public SVG" in error for error in verify(assets)[0])


@pytest.mark.parametrize("operation", ["delete", "stale"])
def test_missing_or_stale_build_copy(assets, operation):
    built = assets / "frontend/dist/logo.svg"
    if operation == "delete":
        built.unlink()
    else:
        built.write_text('<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>')
    assert any("Missing or stale built" in error for error in verify(assets, built.parent)[0])

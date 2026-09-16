"""
Unit tests for BuildingService.
"""

import pytest
from errors import BuildingNotFound
from services.building_service import BuildingService
from tests.conftest import FakeBuildingSource


def test_get_summary_success(fake_source):
    service = BuildingService(fake_source)
    summary = service.get_summary("lc3")

    assert summary["id"] == "lc3"
    assert summary["code"] == "LC3"
    assert summary["name"]["th"] == "อาคารบรรยายรวม 3"
    assert summary["opening_hours"] == "08:00-18:00"
    assert summary["image_url"] == (
        "https://mock-bucket.s3.amazonaws.com/image/building/LC3.webp?expires=3600"
    )
    assert len(summary["floors"]) == 1
    assert summary["floors"][0]["floor_number"] == 1


def test_get_summary_case_insensitive(fake_source):
    service = BuildingService(fake_source)

    summary_upper = service.get_summary("LC3")
    summary_lower = service.get_summary("lc3")

    assert summary_upper == summary_lower


def test_get_summary_preserves_explicit_image_url(sample_building_raw):
    sample = dict(sample_building_raw)
    sample["image_url"] = "https://cdn.example.com/custom-building.webp"
    source = FakeBuildingSource({"lc3": sample})
    service = BuildingService(source)

    summary = service.get_summary("lc3")
    assert summary["image_url"] == "https://cdn.example.com/custom-building.webp"


def test_get_summary_missing_image_returns_none(sample_building_raw):
    sample = dict(sample_building_raw)
    sample["image_key"] = None
    sample["image_url"] = None
    source = FakeBuildingSource({"lc3": sample})
    service = BuildingService(source)

    summary = service.get_summary("lc3")
    assert summary["image_url"] is None


def test_get_summary_raises_building_not_found(fake_source):
    service = BuildingService(fake_source)

    with pytest.raises(BuildingNotFound) as exc_info:
        service.get_summary("NON_EXISTENT")

    assert "Building 'NON_EXISTENT' not found" in str(exc_info.value)


def test_list_buildings_delegates_to_source(fake_source):
    service = BuildingService(fake_source)
    buildings = service.list_buildings()

    assert len(buildings) == 1
    assert buildings[0]["id"] == "lc3"

"""
Unit tests for the Building domain model.
"""

from models.building import Building


def test_building_from_raw_mapping(sample_building_raw):
    image_url = "https://mock-bucket.s3.amazonaws.com/image/building/LC3.webp?expires=3600"
    building = Building.from_raw(sample_building_raw, image_url=image_url)

    assert building.id == "lc3"
    assert building.code == "LC3"
    assert building.name == {
        "th": "อาคารบรรยายรวม 3",
        "en": "Lecture Classroom 3",
    }
    assert building.description == {
        "th": "อาคารเรียนรวม...",
        "en": "A lecture building...",
    }
    assert building.image_url == image_url
    assert building.opening_hours == "08:00-18:00"
    assert building.latitude == 14.0726
    assert building.longitude == 100.6062
    assert len(building.floors) == 1


def test_building_summary_shape(sample_building_raw):
    image_url = "https://mock-bucket.s3.amazonaws.com/image/building/LC3.webp?expires=3600"
    building = Building.from_raw(sample_building_raw, image_url=image_url)
    summary = building.summary()

    # Verify root fields
    assert summary == {
        "id": "lc3",
        "code": "LC3",
        "name": {
            "th": "อาคารบรรยายรวม 3",
            "en": "Lecture Classroom 3",
        },
        "description": {
            "th": "อาคารเรียนรวม...",
            "en": "A lecture building...",
        },
        "image_url": image_url,
        "opening_hours": "08:00-18:00",
        "latitude": 14.0726,
        "longitude": 100.6062,
        "floors": [
            {
                "id": "floor-uuid-1",
                "floor_number": 1,
            }
        ],
    }

    # Verify rooms and facilities are omitted from floor projection
    floor_summary = summary["floors"][0]
    assert "rooms" not in floor_summary
    assert "facilities" not in floor_summary
    assert "floor_plan_key" not in floor_summary


def test_building_summary_with_empty_floors():
    raw = {
        "id": "empty-bld",
        "code": "EMP",
        "name": "Empty Building",
    }
    building = Building.from_raw(raw)
    summary = building.summary()

    assert summary["id"] == "empty-bld"
    assert summary["code"] == "EMP"
    assert summary["floors"] == []

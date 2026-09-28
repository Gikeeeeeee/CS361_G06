import requests
import pytest


BASE_URL = (
    "https://w5irvlq5mg.execute-api.us-east-1.amazonaws.com"
)
SEARCH_URL = f"{BASE_URL}/api/v2/search"


def search(**params):
    response = requests.get(
        SEARCH_URL,
        params=params,
        timeout=70,
    )

    return response


# =========================
# Happy Path
# =========================

def test_search_building_by_code():
    response = search(q="LC4")

    assert response.status_code == 200

    data = response.json()

    assert data["query"] == "LC4"
    assert data["total"] >= 1
    assert len(data["results"]) >= 1

    result = data["results"][0]

    assert result["type"] == "BUILDING"
    assert result["building_code"] == "LC4"


def test_search_building_by_thai_name():
    response = search(q="ศูนย์การเรียนรู้")

    assert response.status_code == 200

    data = response.json()

    assert data["total"] >= 1
    assert any(
        result["type"] == "BUILDING"
        for result in data["results"]
    )


def test_search_room():
    response = search(q="102")

    assert response.status_code == 200

    data = response.json()

    assert data["total"] >= 1
    assert any(
        result["type"] == "ROOM"
        for result in data["results"]
    )


def test_search_facility():
    response = search(q="Water")

    assert response.status_code == 200

    data = response.json()

    assert data["total"] >= 1
    assert any(
        result["type"] == "FACILITY"
        for result in data["results"]
    )


def test_search_schedule():
    response = search(q="CS361")

    assert response.status_code == 200

    data = response.json()

    assert data["total"] >= 1
    assert any(
        result["type"] == "SCHEDULE"
        for result in data["results"]
    )


# =========================
# Type Filter
# =========================

@pytest.mark.parametrize(
    "entity_type,expected_schedule_type",
    [
        ("course", "COURSE"),
        ("exam", "EXAM"),
        ("activity", "ACTIVITY"),
    ],
)
def test_search_schedule_type_filter(
    entity_type,
    expected_schedule_type,
):
    response = search(
        q="CS361",
        type=entity_type,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] >= 1

    for result in data["results"]:
        assert result["type"] == "SCHEDULE"


def test_search_schedule_type():
    response = search(
        q="CS361",
        type="schedule",
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] >= 1

    assert all(
        result["type"] == "SCHEDULE"
        for result in data["results"]
    )


# =========================
# Pagination
# =========================

def test_search_pagination_first_page():
    response = search(
        q="CS361",
        page=1,
        pageSize=1,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["page"] == 1
    assert data["page_size"] == 1
    assert len(data["results"]) <= 1


def test_search_pagination_second_page():
    response = search(
        q="CS361",
        page=2,
        pageSize=1,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["page"] == 2
    assert data["page_size"] == 1
    assert len(data["results"]) <= 1


def test_search_pagination_out_of_range():
    response = search(
        q="CS361",
        page=99,
        pageSize=20,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["page"] == 99
    assert data["results"] == []


# =========================
# Case / Whitespace
# =========================

def test_search_type_case_insensitive():
    lower = search(
        q="CS361",
        type="course",
    )

    upper = search(
        q="CS361",
        type="COURSE",
    )

    assert lower.status_code == 200
    assert upper.status_code == 200

    assert lower.json()["total"] == upper.json()["total"]


def test_search_query_whitespace():
    normal = search(q="CS361")
    padded = search(q=" CS361 ")

    assert normal.status_code == 200
    assert padded.status_code == 200

    assert normal.json()["total"] == padded.json()["total"]


# =========================
# Response Contract
# =========================

def test_search_response_contract():
    response = search(q="LC4")

    assert response.status_code == 200

    data = response.json()

    # Top-level fields
    assert "query" in data
    assert "page" in data
    assert "page_size" in data
    assert "total" in data
    assert "results" in data

    assert isinstance(data["query"], str)
    assert isinstance(data["page"], int)
    assert isinstance(data["page_size"], int)
    assert isinstance(data["total"], int)
    assert isinstance(data["results"], list)


def test_search_result_contract():
    response = search(q="LC4")

    assert response.status_code == 200

    data = response.json()

    assert len(data["results"]) >= 1

    result = data["results"][0]

    expected_fields = {
        "id",
        "type",
        "title",
        "subtitle",
        "building_id",
        "building_code",
        "room_id",
        "room_code",
        "course_code",
    }

    assert expected_fields.issubset(result.keys())


# =========================
# Validation
# =========================

def test_search_missing_query():
    response = search()

    assert response.status_code == 400


def test_search_empty_query():
    response = search(q="")

    assert response.status_code == 400


def test_search_whitespace_query():
    response = search(q="   ")

    assert response.status_code == 400
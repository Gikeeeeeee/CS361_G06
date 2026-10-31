from decimal import Decimal
from unittest.mock import MagicMock
import pytest
from botocore.exceptions import ClientError

from errors import UpstreamError
from repositories.building_repository import BuildingRepository, _deserialize_value, _to_dict


class _MockTable:
    """Mock DynamoDB table capturing queries and returning configured pages."""

    def __init__(self, query_responses=None):
        # query_responses can be a list of responses or a callable/dict
        self._responses = list(query_responses) if query_responses is not None else []
        self.queries = []

    def query(self, **kwargs):
        self.queries.append(kwargs)
        if self._responses:
            res = self._responses.pop(0)
            if isinstance(res, Exception):
                raise res
            return res
        return {"Items": []}


# ---------------------------------------------------------------------------
# Deserialization & Helper Tests
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_deserialize_value_converts_decimals():
    assert _deserialize_value(Decimal("10")) == 10
    assert _deserialize_value(Decimal("14.0726")) == 14.0726
    assert _deserialize_value({"lat": Decimal("14.5"), "floor": Decimal("2")}) == {
        "lat": 14.5,
        "floor": 2,
    }
    assert _deserialize_value([Decimal("1"), Decimal("2.5")]) == [1, 2.5]


@pytest.mark.unit
def test_to_dict_strips_dynamodb_keys():
    item = {
        "PK": "BUILDING#LC3",
        "SK": "BUILDING#LC3",
        "GSI0PK": "BUILDING",
        "GSI0SK": "LC3",
        "GSI1PK": "foo",
        "id": "lc3",
        "code": "LC3",
        "floor_number": Decimal("1"),
    }
    cleaned = _to_dict(item)
    assert cleaned == {
        "id": "lc3",
        "code": "LC3",
        "floor_number": 1,
    }


# ---------------------------------------------------------------------------
# list_buildings Tests
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_list_buildings_success():
    table = _MockTable([
        {
            "Items": [
                {
                    "PK": "BUILDING#LC3",
                    "SK": "BUILDING#LC3",
                    "GSI0PK": "BUILDING",
                    "GSI0SK": "LC3",
                    "id": "lc3",
                    "code": "LC3",
                    "name": {"th": "อาคาร LC3"},
                },
                {
                    "PK": "BUILDING#LC4",
                    "SK": "BUILDING#LC4",
                    "GSI0PK": "BUILDING",
                    "GSI0SK": "LC4",
                    "id": "lc4",
                    "code": "LC4",
                    "name": {"th": "อาคาร LC4"},
                },
            ]
        }
    ])
    repo = BuildingRepository(table=table)
    buildings = repo.list_buildings()

    assert len(buildings) == 2
    assert buildings[0]["code"] == "LC3"
    assert buildings[1]["code"] == "LC4"
    assert "PK" not in buildings[0]
    assert table.queries[0]["IndexName"] == "GSI0"


@pytest.mark.unit
def test_list_buildings_pagination():
    table = _MockTable([
        {
            "Items": [{"PK": "BUILDING#LC3", "SK": "BUILDING#LC3", "code": "LC3"}],
            "LastEvaluatedKey": {"GSI0PK": "BUILDING", "GSI0SK": "LC3"},
        },
        {
            "Items": [{"PK": "BUILDING#LC4", "SK": "BUILDING#LC4", "code": "LC4"}],
        },
    ])
    repo = BuildingRepository(table=table)
    buildings = repo.list_buildings()

    assert len(buildings) == 2
    assert len(table.queries) == 2
    assert table.queries[1]["ExclusiveStartKey"] == {"GSI0PK": "BUILDING", "GSI0SK": "LC3"}


@pytest.mark.unit
def test_list_buildings_upstream_error():
    client_err = ClientError(
        {"Error": {"Code": "ResourceNotFoundException", "Message": "Table not found"}},
        "Query",
    )
    table = _MockTable([client_err])
    repo = BuildingRepository(table=table)

    with pytest.raises(UpstreamError):
        repo.list_buildings()


# ---------------------------------------------------------------------------
# get_building Tests
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_get_building_success():
    table = _MockTable([
        # Query 1: Building partition (PK = BUILDING#LC3)
        {
            "Items": [
                {
                    "PK": "BUILDING#LC3",
                    "SK": "BUILDING#LC3",
                    "id": "lc3",
                    "code": "LC3",
                    "name": {"th": "อาคาร LC3"},
                },
                {
                    "PK": "BUILDING#LC3",
                    "SK": "FLOOR#2",
                    "id": "floor-uuid-2",
                    "floor_number": Decimal("2"),
                },
                {
                    "PK": "BUILDING#LC3",
                    "SK": "FLOOR#1",
                    "id": "floor-uuid-1",
                    "floor_number": Decimal("1"),
                },
            ]
        },
        # Query 2: Floor 1 children (PK = FLOOR#floor-uuid-1)
        {
            "Items": [
                {
                    "PK": "FLOOR#floor-uuid-1",
                    "SK": "ROOM#101",
                    "GSI0PK": "ROOM",
                    "id": "room-1",
                    "room_number": "101",
                }
            ]
        },
        # Query 3: Floor 2 children (PK = FLOOR#floor-uuid-2)
        {
            "Items": [
                {
                    "PK": "FLOOR#floor-uuid-2",
                    "SK": "FACILITY#ELEVATOR#fac-1",
                    "GSI0PK": "FACILITY",
                    "id": "fac-1",
                    "type": "ELEVATOR",
                }
            ]
        },
    ])
    repo = BuildingRepository(table=table)
    building = repo.get_building("lc3")

    assert building is not None
    assert building["id"] == "lc3"
    assert building["code"] == "LC3"
    assert len(building["floors"]) == 2
    # Verify floors are sorted by floor_number
    assert building["floors"][0]["floor_number"] == 1
    assert building["floors"][0]["rooms"][0]["room_number"] == "101"
    assert building["floors"][1]["floor_number"] == 2
    assert building["floors"][1]["facilities"][0]["type"] == "ELEVATOR"


@pytest.mark.unit
def test_get_building_without_children():
    table = _MockTable([
        {
            "Items": [
                {"PK": "BUILDING#LC3", "SK": "BUILDING#LC3", "id": "lc3", "code": "LC3"},
                {"PK": "BUILDING#LC3", "SK": "FLOOR#1", "id": "floor-uuid-1", "floor_number": Decimal("1")},
            ]
        }
    ])
    repo = BuildingRepository(table=table)
    building = repo.get_building("LC3", include_children=False)

    assert building is not None
    assert len(building["floors"]) == 1
    assert "rooms" not in building["floors"][0]
    # Only 1 query executed
    assert len(table.queries) == 1


@pytest.mark.unit
def test_get_building_fallback_to_uuid():
    table = _MockTable([
        # Query 1: Partition query with PK = BUILDING#LC3-UUID -> empty
        {"Items": []},
        # Query 2: GSI0 lookup for BUILDING to resolve UUID -> found code LC3
        {
            "Items": [
                {"GSI0PK": "BUILDING", "id": "lc3-uuid", "code": "LC3"},
            ]
        },
        # Query 3: Partition query with PK = BUILDING#LC3 -> building found
        {
            "Items": [
                {"PK": "BUILDING#LC3", "SK": "BUILDING#LC3", "id": "lc3-uuid", "code": "LC3"},
            ]
        },
    ])
    repo = BuildingRepository(table=table)
    building = repo.get_building("lc3-uuid", include_children=False)

    assert building is not None
    assert building["id"] == "lc3-uuid"
    assert building["code"] == "LC3"


@pytest.mark.unit
def test_get_building_not_found():
    table = _MockTable([
        {"Items": []},  # Partition query empty
        {"Items": []},  # GSI0 lookup empty
    ])
    repo = BuildingRepository(table=table)
    building = repo.get_building("nonexistent")

    assert building is None


# ---------------------------------------------------------------------------
# get_floor Tests
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_get_floor_success():
    table = _MockTable([
        # Query 1: GSI0 lookup for FLOOR -> found floor
        {
            "Items": [
                {
                    "GSI0PK": "FLOOR",
                    "GSI0SK": "LC3#1",
                    "id": "floor-uuid-1",
                    "floor_number": Decimal("1"),
                    "floor_plan_key": "floor-plan/LC3/floor1.svg",
                }
            ]
        },
        # Query 2: Floor partition query for rooms & facilities
        {
            "Items": [
                {
                    "PK": "FLOOR#floor-uuid-1",
                    "SK": "ROOM#101",
                    "GSI0PK": "ROOM",
                    "id": "room-1",
                    "room_number": "101",
                    "name": {"en": "Room 101"},
                },
                {
                    "PK": "FLOOR#floor-uuid-1",
                    "SK": "FACILITY#TOILET#fac-1",
                    "GSI0PK": "FACILITY",
                    "id": "fac-1",
                    "type": "TOILET",
                },
            ]
        },
    ])
    repo = BuildingRepository(table=table)
    floor = repo.get_floor("floor-uuid-1")

    assert floor is not None
    assert floor["id"] == "floor-uuid-1"
    assert floor["floor_number"] == 1
    assert floor["floor_plan_key"] == "floor-plan/LC3/floor1.svg"
    assert len(floor["rooms"]) == 1
    assert floor["rooms"][0]["room_number"] == "101"
    assert len(floor["facilities"]) == 1
    assert floor["facilities"][0]["type"] == "TOILET"


@pytest.mark.unit
def test_get_floor_not_found():
    table = _MockTable([
        # Query 1: GSI0 lookup returns different floor or empty
        {"Items": [{"GSI0PK": "FLOOR", "id": "other-uuid"}]}
    ])
    repo = BuildingRepository(table=table)
    floor = repo.get_floor("nonexistent-floor")

    assert floor is None


# ---------------------------------------------------------------------------
# presigned_url Tests
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_presigned_url_generates_url():
    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.return_value = "https://s3.example.com/asset.svg?sig=123"

    repo = BuildingRepository(table=_MockTable(), bucket_name="my-bucket", s3_client=mock_s3)
    url = repo.presigned_url("floor-plan/LC3/floor1.svg", expires_in=1800)

    assert url == "https://s3.example.com/asset.svg?sig=123"
    mock_s3.generate_presigned_url.assert_called_once_with(
        "get_object",
        Params={"Bucket": "my-bucket", "Key": "floor-plan/LC3/floor1.svg"},
        ExpiresIn=1800,
    )


@pytest.mark.unit
def test_presigned_url_empty_key():
    mock_s3 = MagicMock()
    repo = BuildingRepository(table=_MockTable(), bucket_name="my-bucket", s3_client=mock_s3)
    assert repo.presigned_url("") == ""
    assert repo.presigned_url(None) == ""
    mock_s3.generate_presigned_url.assert_not_called()


# ---------------------------------------------------------------------------
# TTL cache (#243)
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_reads_are_cached_until_ttl_expires(monkeypatch):
    import repositories.building_repository as mod

    clock = [1000.0]
    monkeypatch.setattr(mod.time, "monotonic", lambda: clock[0])
    table = _MockTable()
    repo = BuildingRepository(table_name="t", table=table)

    repo.list_buildings()
    repo.get_building("LC3")
    repo.get_floor("f1")
    queries = len(table.queries)

    repo.list_buildings()
    repo.get_building("lc3")
    repo.get_floor("f1")
    assert len(table.queries) == queries  # warm hits: no DynamoDB I/O

    clock[0] += mod.CACHE_TTL_SECONDS + 1
    repo.list_buildings()
    assert len(table.queries) == queries + 1  # expired: reloaded

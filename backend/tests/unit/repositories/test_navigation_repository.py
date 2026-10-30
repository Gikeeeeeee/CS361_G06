from decimal import Decimal
from unittest.mock import MagicMock
import pytest
from botocore.exceptions import ClientError

from errors import UpstreamError
from repositories.navigation_repository import (
    NavigationRepository,
    _deserialize_value,
    _to_clean_dict,
)


@pytest.mark.unit
def test_deserialize_value_conversions():
    assert _deserialize_value(Decimal("100")) == 100
    assert _deserialize_value(Decimal("100.5")) == 100.5
    assert _deserialize_value({"a": Decimal("10"), "b": [Decimal("2.5")]}) == {
        "a": 10,
        "b": [2.5],
    }
    assert _deserialize_value("string") == "string"


@pytest.mark.unit
def test_to_clean_dict_strips_internal_keys():
    raw = {
        "PK": "FLOOR#1",
        "SK": "NAV_NODE#N1",
        "GSI0PK": "NODE",
        "GSI0SK": "N1",
        "id": "N1",
        "svg_x": Decimal("150"),
    }
    cleaned = _to_clean_dict(raw)
    assert "PK" not in cleaned
    assert "SK" not in cleaned
    assert "GSI0PK" not in cleaned
    assert cleaned["id"] == "N1"
    assert cleaned["svg_x"] == 150


@pytest.mark.unit
def test_get_floor_navigation_data_success():
    table = MagicMock()
    table.query.return_value = {
        "Items": [
            {
                "PK": "FLOOR#f1",
                "SK": "NAV_NODE#N1",
                "id": "N1",
                "name": "Node 1",
                "node_type": "JUNCTION",
                "status": "ACTIVE",
                "svg_x": Decimal("100"),
                "svg_y": Decimal("200"),
            },
            {
                "PK": "FLOOR#f1",
                "SK": "CORRIDOR_EDGE#E1",
                "id": "E1",
                "from_node_id": "N1",
                "to_node_id": "N2",
                "distance_weight": Decimal("50.5"),
                "status": "ACTIVE",
            },
            {
                "PK": "FLOOR#f1",
                "SK": "QR#QR1",
                "id": "QR1",
                "node_id": "N1",
                "location_description": "Entrance",
            },
            {
                "PK": "FLOOR#f1",
                "SK": "ROOM#101",
                "id": "r1",
                "room_number": "101",
                "corridor_edge_id": "E1",
                "door_svg_x": Decimal("120"),
                "door_svg_y": Decimal("180"),
                "side": "LEFT",
                "sequence_order": Decimal("1"),
            },
        ]
    }

    repo = NavigationRepository(table=table)
    data = repo.get_floor_navigation_data("f1")

    assert len(data["nodes"]) == 1
    assert data["nodes"][0].id == "N1"
    assert data["nodes"][0].svg_x == 100.0

    assert len(data["edges"]) == 1
    assert data["edges"][0].id == "E1"
    assert data["edges"][0].distance_weight == 50.5

    assert len(data["qrs"]) == 1
    assert data["qrs"][0].id == "QR1"

    assert len(data["rooms"]) == 1
    assert data["rooms"][0].room_number == "101"
    assert data["rooms"][0].side == "LEFT"
    assert data["rooms"][0].sequence_order == 1


@pytest.mark.unit
def test_get_floor_navigation_data_client_error():
    table = MagicMock()
    table.query.side_effect = ClientError(
        {"Error": {"Code": "ResourceNotFoundException", "Message": "Table not found"}},
        "Query",
    )

    repo = NavigationRepository(table=table)
    with pytest.raises(UpstreamError, match="DynamoDB error fetching navigation data"):
        repo.get_floor_navigation_data("f1")


@pytest.mark.unit
def test_find_qr_with_floor_id():
    table = MagicMock()
    table.get_item.return_value = {
        "Item": {
            "PK": "FLOOR#f1",
            "SK": "QR#QR1",
            "id": "QR1",
            "node_id": "N1",
        }
    }

    repo = NavigationRepository(table=table)
    qr = repo.find_qr("QR1", "f1")

    assert qr is not None
    assert qr["id"] == "QR1"
    assert qr["node_id"] == "N1"


@pytest.mark.unit
def test_find_node_with_floor_id():
    table = MagicMock()
    table.get_item.return_value = {
        "Item": {
            "PK": "FLOOR#f1",
            "SK": "NAV_NODE#N1",
            "id": "N1",
            "svg_x": Decimal("50"),
        }
    }

    repo = NavigationRepository(table=table)
    node = repo.find_node("N1", "f1")

    assert node is not None
    assert node["id"] == "N1"
    assert node["svg_x"] == 50


@pytest.mark.unit
def test_get_vertical_connections_success_and_case_normalization():
    table = MagicMock()
    table.query.return_value = {
        "Items": [
            {
                "PK": "BUILDING#LC4",
                "SK": "VERTICAL_CONNECTION#LC4-ELEV-F1-F2",
                "id": "LC4-ELEV-F1-F2",
                "building_id": "lc4",
                "connection_type": "ELEVATOR",
                "from_floor_id": "floor-1",
                "from_node_id": "N1",
                "to_floor_id": "floor-2",
                "to_node_id": "N2",
                "distance_weight": Decimal("40.0"),
                "status": "ACTIVE",
                "bidirectional": True,
                "name": "Elevator F1-F2",
            }
        ]
    }

    repo = NavigationRepository(table=table)
    # Test lowercase building_id "lc4" queries BUILDING#LC4
    conns = repo.get_vertical_connections("lc4")

    assert len(conns) == 1
    conn = conns[0]
    assert conn.id == "LC4-ELEV-F1-F2"
    assert conn.connection_type == "ELEVATOR"
    assert conn.distance_weight == 40.0
    assert conn.is_active is True
    assert conn.name == "Elevator F1-F2"


@pytest.mark.unit
def test_get_vertical_connections_client_error():
    table = MagicMock()
    table.query.side_effect = ClientError(
        {"Error": {"Code": "InternalServerError", "Message": "Boom"}},
        "Query",
    )

    repo = NavigationRepository(table=table)
    with pytest.raises(UpstreamError, match="DynamoDB error fetching vertical connections"):
        repo.get_vertical_connections("lc4")

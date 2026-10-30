"""
Driven adapter: reads navigation graphs, corridor edges, and nodes from Amazon DynamoDB.

Implements `ports.navigation_source.NavigationSource`.
Layer: driven adapter (outbound).
"""

from decimal import Decimal
import os
from typing import Any

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from errors import UpstreamError
from models.navigation import (
    CorridorEdge,
    NavigationNode,
    QRLocation,
    RoomAttachment,
    VerticalConnection,
)
from ports.navigation_source import NavigationSource
from repositories.dynamodb_entity_reader import DynamoDBEntityReader

_KEY_ATTRS = {"PK", "SK"} | {
    f"GSI{index}{part}" for index in range(7) for part in ("PK", "SK")
}


def _deserialize_value(val: Any) -> Any:
    """Recursively convert Decimal types to int or float."""
    if isinstance(val, Decimal):
        return int(val) if val % 1 == 0 else float(val)
    if isinstance(val, dict):
        return {k: _deserialize_value(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_deserialize_value(v) for v in val]
    return val


def _to_clean_dict(item: dict[str, Any]) -> dict[str, Any]:
    """DynamoDB item -> domain dict, without PK/SK/GSI keys and with Decimals converted."""
    return {
        name: _deserialize_value(value)
        for name, value in item.items()
        if name not in _KEY_ATTRS
    }


class NavigationRepository(NavigationSource):
    """DynamoDB-backed implementation of the NavigationSource port."""

    def __init__(
        self,
        table_name: str | None = None,
        table: Any = None,
        reader: DynamoDBEntityReader | None = None,
    ):
        self.table_name = (
            table_name
            if table_name is not None
            else os.environ.get("DYNAMODB_TABLE_NAME", "")
        )
        self._table = table
        self._reader = reader or DynamoDBEntityReader(
            table=self._table, table_name=self.table_name
        )

    @property
    def table(self):
        """Created lazily so importing this module never touches the network."""
        if self._table is None:
            self._table = boto3.resource("dynamodb").Table(self.table_name)
        return self._table

    def get_floor_navigation_data(self, floor_id: str) -> dict[str, Any]:
        """Fetch all navigation nodes, edges, QRs, and room attachments for a floor."""
        try:
            items: list[dict[str, Any]] = []
            response = self.table.query(
                KeyConditionExpression=Key("PK").eq(f"FLOOR#{floor_id}")
            )
            items.extend(response.get("Items", []))
            while "LastEvaluatedKey" in response:
                response = self.table.query(
                    KeyConditionExpression=Key("PK").eq(f"FLOOR#{floor_id}"),
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                items.extend(response.get("Items", []))

            nodes: list[NavigationNode] = []
            edges: list[CorridorEdge] = []
            qrs: list[QRLocation] = []
            rooms: list[RoomAttachment] = []

            for raw in items:
                clean = _to_clean_dict(raw)
                sk = str(raw.get("SK", ""))

                if sk.startswith("NAV_NODE#"):
                    nodes.append(
                        NavigationNode(
                            id=clean.get("id", ""),
                            name=clean.get("name"),
                            node_type=clean.get("node_type", "JUNCTION"),
                            status=clean.get("status", "ACTIVE"),
                            svg_x=float(clean.get("svg_x", 0.0)),
                            svg_y=float(clean.get("svg_y", 0.0)),
                            floor_id=floor_id,
                        )
                    )
                elif sk.startswith("CORRIDOR_EDGE#"):
                    edges.append(
                        CorridorEdge(
                            id=clean.get("id", ""),
                            from_node_id=clean.get("from_node_id", ""),
                            to_node_id=clean.get("to_node_id", ""),
                            distance_weight=float(clean.get("distance_weight", 0.0)),
                            status=clean.get("status", "ACTIVE"),
                            floor_id=floor_id,
                        )
                    )
                elif sk.startswith("QR#"):
                    qrs.append(
                        QRLocation(
                            id=clean.get("id", ""),
                            node_id=clean.get("node_id", ""),
                            location_description=clean.get("location_description"),
                            floor_id=floor_id,
                        )
                    )
                elif sk.startswith("ROOM#") and clean.get("corridor_edge_id"):
                    door_x = clean.get("door_svg_x")
                    door_y = clean.get("door_svg_y")
                    seq = clean.get("sequence_order")
                    rooms.append(
                        RoomAttachment(
                            room_id=clean.get("id", ""),
                            room_number=clean.get("room_number"),
                            name=clean.get("name"),
                            corridor_edge_id=clean.get("corridor_edge_id", ""),
                            door_svg_x=float(door_x) if door_x is not None else None,
                            door_svg_y=float(door_y) if door_y is not None else None,
                            side=str(clean.get("side", "RIGHT")).upper(),
                            sequence_order=int(seq) if seq is not None else None,
                            floor_id=floor_id,
                            building_id=clean.get("building_id", ""),
                            status=clean.get("status", "ACTIVE"),
                        )
                    )

            return {
                "nodes": nodes,
                "edges": edges,
                "qrs": qrs,
                "rooms": rooms,
            }
        except ClientError as exc:
            raise UpstreamError(
                f"DynamoDB error fetching navigation data for floor '{floor_id}': {exc}"
            ) from exc

    def get_room(self, room_id: str) -> dict[str, Any] | None:
        """Fetch raw room data by UUID or room number."""
        return self._reader.find_by_id("ROOM", room_id, match_room_number=True)

    def get_floor(self, floor_id: str) -> dict[str, Any] | None:
        """Fetch raw floor data by UUID."""
        return self._reader.find_by_id("FLOOR", floor_id)

    def find_qr(self, qr_id: str, floor_id: str | None = None) -> dict[str, Any] | None:
        """Locate a QR code record by ID."""
        if floor_id:
            try:
                response = self.table.get_item(
                    Key={"PK": f"FLOOR#{floor_id}", "SK": f"QR#{qr_id}"}
                )
                item = response.get("Item")
                return _to_clean_dict(item) if item else None
            except ClientError as exc:
                raise UpstreamError(
                    f"DynamoDB error getting QR '{qr_id}': {exc}"
                ) from exc

        # Global lookup across QR codes
        try:
            response = self.table.scan(
                FilterExpression=Attr("entity_type").eq("QR_LOCATION")
                & Attr("id").eq(qr_id)
            )
            items = response.get("Items", [])
            if items:
                clean = _to_clean_dict(items[0])
                pk = str(items[0].get("PK", ""))
                if pk.startswith("FLOOR#"):
                    clean["floor_id"] = pk.replace("FLOOR#", "")
                return clean
            return None
        except ClientError as exc:
            raise UpstreamError(
                f"DynamoDB scan error searching for QR '{qr_id}': {exc}"
            ) from exc

    def find_node(
        self, node_id: str, floor_id: str | None = None
    ) -> dict[str, Any] | None:
        """Locate a navigation node record by ID."""
        if floor_id:
            try:
                response = self.table.get_item(
                    Key={"PK": f"FLOOR#{floor_id}", "SK": f"NAV_NODE#{node_id}"}
                )
                item = response.get("Item")
                return _to_clean_dict(item) if item else None
            except ClientError as exc:
                raise UpstreamError(
                    f"DynamoDB error getting node '{node_id}': {exc}"
                ) from exc

        try:
            response = self.table.scan(
                FilterExpression=Attr("entity_type").eq("NAVIGATION_NODE")
                & Attr("id").eq(node_id)
            )
            items = response.get("Items", [])
            if items:
                clean = _to_clean_dict(items[0])
                pk = str(items[0].get("PK", ""))
                if pk.startswith("FLOOR#"):
                    clean["floor_id"] = pk.replace("FLOOR#", "")
                return clean
            return None
        except ClientError as exc:
            raise UpstreamError(
                f"DynamoDB scan error searching for node '{node_id}': {exc}"
            ) from exc

    def get_vertical_connections(self, building_id: str) -> list[VerticalConnection]:
        """Fetch all vertical connections for a building."""
        code = str(building_id).upper()
        try:
            items: list[dict[str, Any]] = []
            response = self.table.query(
                KeyConditionExpression=Key("PK").eq(f"BUILDING#{code}")
                & Key("SK").begins_with("VERTICAL_CONNECTION#")
            )
            items.extend(response.get("Items", []))
            while "LastEvaluatedKey" in response:
                response = self.table.query(
                    KeyConditionExpression=Key("PK").eq(f"BUILDING#{code}")
                    & Key("SK").begins_with("VERTICAL_CONNECTION#"),
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                items.extend(response.get("Items", []))

            if not items and str(building_id) != code:
                response = self.table.query(
                    KeyConditionExpression=Key("PK").eq(f"BUILDING#{building_id}")
                    & Key("SK").begins_with("VERTICAL_CONNECTION#")
                )
                items.extend(response.get("Items", []))

            conns: list[VerticalConnection] = []
            for raw in items:
                clean = _to_clean_dict(raw)
                conns.append(
                    VerticalConnection(
                        id=clean.get(
                            "id",
                            str(raw.get("SK", "")).replace("VERTICAL_CONNECTION#", ""),
                        ),
                        building_id=clean.get("building_id", building_id),
                        connection_type=str(
                            clean.get("connection_type", "STAIRS")
                        ).upper(),
                        from_floor_id=clean.get("from_floor_id", ""),
                        from_node_id=clean.get("from_node_id", ""),
                        to_floor_id=clean.get("to_floor_id", ""),
                        to_node_id=clean.get("to_node_id", ""),
                        distance_weight=float(clean.get("distance_weight", 30.0)),
                        status=clean.get("status", "ACTIVE"),
                        bidirectional=bool(clean.get("bidirectional", True)),
                        name=clean.get("name"),
                    )
                )
            return conns
        except ClientError as exc:
            raise UpstreamError(
                f"DynamoDB error fetching vertical connections for building '{building_id}': {exc}"
            ) from exc

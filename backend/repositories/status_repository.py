"""
Driven adapter: DynamoDB persistence for floor status overlays and dynamic status updates.

Layer: driven adapter (outbound).
"""

from datetime import datetime, timezone
from decimal import Decimal
import os
from typing import Any

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from errors import (
    CorridorEdgeNotFound,
    FloorNotFound,
    InvalidStatusValue,
    NavigationNodeNotFound,
    RoomNotFound,
    UpstreamError,
)
from repositories.dynamodb_entity_reader import DynamoDBEntityReader

_KEY_ATTRS = {"PK", "SK"} | {
    f"GSI{index}{part}" for index in range(7) for part in ("PK", "SK")
}


def _deserialize_value(val: Any) -> Any:
    if isinstance(val, Decimal):
        return int(val) if val % 1 == 0 else float(val)
    if isinstance(val, dict):
        return {k: _deserialize_value(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_deserialize_value(v) for v in val]
    return val


def _to_clean_dict(item: dict[str, Any]) -> dict[str, Any]:
    return {
        name: _deserialize_value(value)
        for name, value in item.items()
        if name not in _KEY_ATTRS
    }


class StatusRepository:
    """Repository handling status overlays and dynamic status mutations."""

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
        if self._table is None:
            self._table = boto3.resource("dynamodb").Table(self.table_name)
        return self._table

    def get_floor_status_overlay(self, floor_id: str) -> dict[str, Any]:
        """Fetch real-time status overlay for rooms, corridor edges, and navigation nodes on a floor."""
        floor_item = self._reader.find_by_id("FLOOR", floor_id)
        if not floor_item:
            # Check direct PK query in case GSI0 is delayed or not populated
            try:
                pk_check = self.table.query(
                    KeyConditionExpression=Key("PK").eq(f"FLOOR#{floor_id}"),
                    Limit=1,
                )
                if not pk_check.get("Items"):
                    raise FloorNotFound(
                        floor_id,
                        message=f"Floor with ID {floor_id} does not exist.",
                    )
            except ClientError as exc:
                raise UpstreamError(
                    f"DynamoDB error checking floor '{floor_id}': {exc}"
                ) from exc

        try:
            items: list[dict[str, Any]] = []
            kwargs = {
                "KeyConditionExpression": Key("PK").eq(f"FLOOR#{floor_id}"),
            }
            while True:
                response = self.table.query(**kwargs)
                items.extend(response.get("Items", []))
                last_key = response.get("LastEvaluatedKey")
                if not last_key:
                    break
                kwargs["ExclusiveStartKey"] = last_key

            rooms: list[dict[str, Any]] = []
            corridor_edges: list[dict[str, Any]] = []
            navigation_nodes: list[dict[str, Any]] = []
            timestamps: list[str] = []

            for raw in items:
                clean = _to_clean_dict(raw)
                sk = str(raw.get("SK", ""))
                u_at = clean.get("updated_at")
                if u_at:
                    timestamps.append(str(u_at))

                if sk.startswith("ROOM#"):
                    r_id = clean.get("id") or sk.replace("ROOM#", "")
                    r_code = (
                        clean.get("room_code")
                        or clean.get("room_number")
                        or clean.get("id")
                        or r_id
                    )
                    rooms.append(
                        {
                            "room_id": r_id,
                            "room_code": r_code,
                            "status": clean.get("status", "ACTIVE"),
                            "status_note": clean.get("status_note", None),
                        }
                    )
                elif sk.startswith("CORRIDOR_EDGE#"):
                    e_id = clean.get("id") or sk.replace("CORRIDOR_EDGE#", "")
                    corridor_edges.append(
                        {
                            "edge_id": e_id,
                            "status": clean.get("status", "ACTIVE"),
                            "status_note": clean.get("status_note", None),
                        }
                    )
                elif sk.startswith("NAV_NODE#"):
                    n_id = clean.get("id") or sk.replace("NAV_NODE#", "")
                    navigation_nodes.append(
                        {
                            "node_id": n_id,
                            "status": clean.get("status", "ACTIVE"),
                            "status_note": clean.get("status_note", None),
                        }
                    )

            latest_updated_at = (
                max(timestamps)
                if timestamps
                else datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            )

            return {
                "floor_id": floor_id,
                "updated_at": latest_updated_at,
                "rooms": rooms,
                "corridor_edges": corridor_edges,
                "navigation_nodes": navigation_nodes,
            }
        except ClientError as exc:
            raise UpstreamError(
                f"DynamoDB error querying floor status overlay for '{floor_id}': {exc}"
            ) from exc

    def _find_item(
        self,
        entity_type: str,
        entity_id: str,
        sk_prefix: str,
        match_room_number: bool = False,
    ) -> dict[str, Any] | None:
        """Finds raw DynamoDB item with PK and SK preserved."""
        # 1. Try GSI0
        try:
            matches = Attr("id").eq(entity_id)
            if match_room_number:
                matches = (
                    matches
                    | Attr("room_number").eq(entity_id)
                    | Attr("room_code").eq(entity_id)
                )

            response = self.table.query(
                IndexName="GSI0",
                KeyConditionExpression=Key("GSI0PK").eq(entity_type),
                FilterExpression=matches,
            )
            items = response.get("Items", [])
            if items:
                return items[0]
        except (ClientError, Exception):
            pass

        # 2. Try Scan fallback
        try:
            filter_expr = Attr("SK").begins_with(sk_prefix) & (
                Attr("id").eq(entity_id) | Attr("SK").eq(f"{sk_prefix}{entity_id}")
            )
            if match_room_number:
                filter_expr = filter_expr | (
                    Attr("SK").begins_with(sk_prefix)
                    & (
                        Attr("room_number").eq(entity_id)
                        | Attr("room_code").eq(entity_id)
                    )
                )

            scan_resp = self.table.scan(FilterExpression=filter_expr)
            scan_items = scan_resp.get("Items", [])
            if scan_items:
                return scan_items[0]
        except ClientError as exc:
            raise UpstreamError(
                f"DynamoDB error scanning for {entity_type} '{entity_id}': {exc}"
            ) from exc

        return None

    def update_room_status(
        self,
        room_id: str,
        status: str,
        status_note: str | None = None,
        updated_by: str | None = None,
    ) -> dict[str, Any]:
        """Update room status and status_note."""
        valid_statuses = {"ACTIVE", "CLOSED", "MAINTENANCE"}
        clean_status = (status or "").upper()
        if clean_status not in valid_statuses:
            raise InvalidStatusValue(
                "Status must be one of: ACTIVE, CLOSED, MAINTENANCE."
            )

        raw_item = self._find_item("ROOM", room_id, "ROOM#", match_room_number=True)
        if not raw_item:
            raise RoomNotFound(
                room_id,
                message=f"Room with ID {room_id} does not exist.",
            )

        pk = raw_item["PK"]
        sk = raw_item["SK"]
        actual_room_id = raw_item.get("id") or room_id
        room_code = (
            raw_item.get("room_code") or raw_item.get("room_number") or actual_room_id
        )

        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        update_expr = "SET #s = :s, #u_at = :u_at, #u_by = :u_by"
        expr_names = {
            "#s": "status",
            "#u_at": "updated_at",
            "#u_by": "updated_by",
        }
        expr_values: dict[str, Any] = {
            ":s": clean_status,
            ":u_at": now_iso,
            ":u_by": updated_by or "system",
        }

        if status_note is not None:
            update_expr += ", #s_note = :s_note"
            expr_names["#s_note"] = "status_note"
            expr_values[":s_note"] = status_note
        else:
            update_expr += " REMOVE #s_note"
            expr_names["#s_note"] = "status_note"

        try:
            self.table.update_item(
                Key={"PK": pk, "SK": sk},
                UpdateExpression=update_expr,
                ConditionExpression="attribute_exists(PK)",
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
            )
        except ClientError as exc:
            raise UpstreamError(
                f"DynamoDB error updating room status for '{room_id}': {exc}"
            ) from exc

        return {
            "room_id": actual_room_id,
            "room_code": room_code,
            "status": clean_status,
            "status_note": status_note,
            "updated_by": updated_by or "system",
            "updated_at": now_iso,
        }

    def update_corridor_edge_status(
        self,
        edge_id: str,
        status: str,
        status_note: str | None = None,
        updated_by: str | None = None,
    ) -> dict[str, Any]:
        """Update corridor edge status and status_note."""
        valid_statuses = {"ACTIVE", "BLOCKED"}
        clean_status = (status or "").upper()
        if clean_status not in valid_statuses:
            raise InvalidStatusValue("Status must be one of: ACTIVE, BLOCKED.")

        raw_item = self._find_item("CORRIDOR_EDGE", edge_id, "CORRIDOR_EDGE#")
        if not raw_item:
            raise CorridorEdgeNotFound(edge_id)

        pk = raw_item["PK"]
        sk = raw_item["SK"]
        actual_edge_id = raw_item.get("id") or edge_id

        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        update_expr = "SET #s = :s, #u_at = :u_at, #u_by = :u_by"
        expr_names = {
            "#s": "status",
            "#u_at": "updated_at",
            "#u_by": "updated_by",
        }
        expr_values: dict[str, Any] = {
            ":s": clean_status,
            ":u_at": now_iso,
            ":u_by": updated_by or "system",
        }

        if status_note is not None:
            update_expr += ", #s_note = :s_note"
            expr_names["#s_note"] = "status_note"
            expr_values[":s_note"] = status_note
        else:
            update_expr += " REMOVE #s_note"
            expr_names["#s_note"] = "status_note"

        try:
            self.table.update_item(
                Key={"PK": pk, "SK": sk},
                UpdateExpression=update_expr,
                ConditionExpression="attribute_exists(PK)",
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
            )
        except ClientError as exc:
            raise UpstreamError(
                f"DynamoDB error updating corridor edge status for '{edge_id}': {exc}"
            ) from exc

        return {
            "edge_id": actual_edge_id,
            "status": clean_status,
            "status_note": status_note,
            "updated_by": updated_by or "system",
            "updated_at": now_iso,
        }

    def update_navigation_node_status(
        self,
        node_id: str,
        status: str,
        status_note: str | None = None,
        updated_by: str | None = None,
    ) -> dict[str, Any]:
        """Update navigation node status and status_note."""
        valid_statuses = {"ACTIVE", "BLOCKED"}
        clean_status = (status or "").upper()
        if clean_status not in valid_statuses:
            raise InvalidStatusValue("Status must be one of: ACTIVE, BLOCKED.")

        raw_item = self._find_item("NAV_NODE", node_id, "NAV_NODE#")
        if not raw_item:
            raw_item = self._find_item("NAVIGATION_NODE", node_id, "NAV_NODE#")
        if not raw_item:
            raise NavigationNodeNotFound(node_id)

        pk = raw_item["PK"]
        sk = raw_item["SK"]
        actual_node_id = raw_item.get("id") or node_id

        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        update_expr = "SET #s = :s, #u_at = :u_at, #u_by = :u_by"
        expr_names = {
            "#s": "status",
            "#u_at": "updated_at",
            "#u_by": "updated_by",
        }
        expr_values: dict[str, Any] = {
            ":s": clean_status,
            ":u_at": now_iso,
            ":u_by": updated_by or "system",
        }

        if status_note is not None:
            update_expr += ", #s_note = :s_note"
            expr_names["#s_note"] = "status_note"
            expr_values[":s_note"] = status_note
        else:
            update_expr += " REMOVE #s_note"
            expr_names["#s_note"] = "status_note"

        try:
            self.table.update_item(
                Key={"PK": pk, "SK": sk},
                UpdateExpression=update_expr,
                ConditionExpression="attribute_exists(PK)",
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
            )
        except ClientError as exc:
            raise UpstreamError(
                f"DynamoDB error updating navigation node status for '{node_id}': {exc}"
            ) from exc

        return {
            "node_id": actual_node_id,
            "status": clean_status,
            "status_note": status_note,
            "updated_by": updated_by or "system",
            "updated_at": now_iso,
        }

"""
Driven adapter: reads building data from Amazon DynamoDB and generates asset URLs via Amazon S3.

This module implements `ports.building_source.BuildingSource`.

Layer: driven adapter (outbound).
"""

from decimal import Decimal
import os
import time
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from errors import UpstreamError

# Master data barely changes and is only written offline by migration/writer.py,
# so a per-container TTL is enough; no invalidation.
CACHE_TTL_SECONDS = 600

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


def _to_dict(item: dict[str, Any]) -> dict[str, Any]:
    """DynamoDB item -> domain dict, without PK/SK/GSI keys and with Decimals converted."""
    return {
        name: _deserialize_value(value)
        for name, value in item.items()
        if name not in _KEY_ATTRS
    }


class BuildingRepository:
    """DynamoDB-backed implementation of the BuildingSource port."""

    def __init__(
        self,
        table_name: str | None = None,
        table: Any = None,
        bucket_name: str | None = None,
        s3_client: Any = None,
    ):
        self.table_name = (
            table_name
            if table_name is not None
            else os.environ.get("DYNAMODB_TABLE_NAME", "")
        )
        self._table = table
        self.bucket_name = (
            bucket_name
            if bucket_name is not None
            else os.environ.get("BUCKET_NAME", "")
        )
        self._s3_client = s3_client
        self._cache: dict[tuple, tuple[float, Any]] = {}

    def _cached(self, key: tuple, load):
        """Return `load()`, reusing the result for CACHE_TTL_SECONDS on a warm container."""
        hit = self._cache.get(key)
        if hit and hit[0] > time.monotonic():
            return hit[1]
        value = load()
        self._cache[key] = (time.monotonic() + CACHE_TTL_SECONDS, value)
        return value

    @property
    def table(self):
        """Created lazily so importing this module never touches the network."""
        if self._table is None:
            self._table = boto3.resource("dynamodb").Table(self.table_name)
        return self._table

    @property
    def s3_client(self):
        """Created lazily so importing this module never touches the network."""
        if self._s3_client is None:
            self._s3_client = boto3.client("s3")
        return self._s3_client

    # -- BuildingSource ----------------------------------------------------

    def list_buildings(self) -> list[dict[str, Any]]:
        """Every building summary from DynamoDB GSI0 index."""
        return self._cached(("buildings",), self._load_buildings)

    def get_building(
        self, building_id: str, include_children: bool = True
    ) -> dict[str, Any] | None:
        """
        One building's raw record, or None if no such building exists.

        Queries the building's partition (PK = BUILDING#{code.upper()}).
        Returns building metadata and its floors.
        """
        return self._cached(
            ("building", str(building_id).upper(), include_children),
            lambda: self._load_building(building_id, include_children),
        )

    def get_floor(self, floor_id: str) -> dict[str, Any] | None:
        """
        One floor's raw record addressed by uuid alone, or None if no such floor exists.

        Locates the floor in GSI0, then queries the floor partition (PK = FLOOR#{floor_id})
        to assemble its rooms and facilities.
        """
        return self._cached(("floor", str(floor_id)), lambda: self._load_floor(floor_id))

    def _load_buildings(self) -> list[dict[str, Any]]:
        try:
            items = []
            response = self.table.query(
                IndexName="GSI0",
                KeyConditionExpression=Key("GSI0PK").eq("BUILDING"),
            )
            items.extend(response.get("Items", []))
            while "LastEvaluatedKey" in response:
                response = self.table.query(
                    IndexName="GSI0",
                    KeyConditionExpression=Key("GSI0PK").eq("BUILDING"),
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                items.extend(response.get("Items", []))

            return [_to_dict(item) for item in items]
        except ClientError as exc:
            raise UpstreamError(
                f"AWS DynamoDB client error querying buildings: {exc}"
            ) from exc

    def _load_building(
        self, building_id: str, include_children: bool
    ) -> dict[str, Any] | None:
        code = str(building_id).upper()
        items = self._query_building_partition(code)

        if not items:
            building_code = self._find_code_by_building_uuid(str(building_id))
            if building_code:
                code = building_code
                items = self._query_building_partition(code)
            if not items:
                return None

        building_item = None
        floors = []
        for raw in items:
            sk = str(raw.get("SK", ""))
            if sk == f"BUILDING#{code}" or (sk.startswith("BUILDING#") and not building_item):
                building_item = _to_dict(raw)
            elif sk.startswith("FLOOR#"):
                floors.append(_to_dict(raw))

        if not building_item:
            return None

        floors.sort(key=lambda f: f.get("floor_number", 0))

        if include_children:
            for floor in floors:
                floor_id = floor.get("id")
                if floor_id:
                    rooms, facilities = self._get_floor_children(str(floor_id))
                    floor["rooms"] = rooms
                    floor["facilities"] = facilities

        building_item["floors"] = floors
        return building_item

    def _load_floor(self, floor_id: str) -> dict[str, Any] | None:
        floor_item = self._find_floor_item_by_uuid(str(floor_id))
        if not floor_item:
            return None

        rooms, facilities = self._get_floor_children(str(floor_id))
        floor = _to_dict(floor_item)
        floor["rooms"] = rooms
        floor["facilities"] = facilities
        return floor

    def presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """A time-limited GET URL for a stored object (used for floor plans and images)."""
        if not key:
            return ""
        try:
            return self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": key},
                ExpiresIn=expires_in,
            )
        except ClientError as exc:
            raise UpstreamError(
                f"AWS S3 client error generating presigned URL for '{key}': {exc}"
            ) from exc

    # -- Internal query helpers --------------------------------------------

    def _query_building_partition(self, code: str) -> list[dict[str, Any]]:
        try:
            items = []
            response = self.table.query(
                KeyConditionExpression=Key("PK").eq(f"BUILDING#{code}")
            )
            items.extend(response.get("Items", []))
            while "LastEvaluatedKey" in response:
                response = self.table.query(
                    KeyConditionExpression=Key("PK").eq(f"BUILDING#{code}"),
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                items.extend(response.get("Items", []))
            return items
        except ClientError as exc:
            raise UpstreamError(
                f"AWS DynamoDB client error querying building partition '{code}': {exc}"
            ) from exc

    def _find_code_by_building_uuid(self, building_uuid: str) -> str | None:
        try:
            response = self.table.query(
                IndexName="GSI0",
                KeyConditionExpression=Key("GSI0PK").eq("BUILDING"),
            )
            items = list(response.get("Items", []))
            while "LastEvaluatedKey" in response:
                response = self.table.query(
                    IndexName="GSI0",
                    KeyConditionExpression=Key("GSI0PK").eq("BUILDING"),
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                items.extend(response.get("Items", []))

            for item in items:
                if str(item.get("id")) == building_uuid:
                    return str(item.get("code", "")).upper()
            return None
        except ClientError:
            return None

    def _find_floor_item_by_uuid(self, floor_id: str) -> dict[str, Any] | None:
        try:
            response = self.table.query(
                IndexName="GSI0",
                KeyConditionExpression=Key("GSI0PK").eq("FLOOR"),
            )
            items = list(response.get("Items", []))
            while "LastEvaluatedKey" in response:
                response = self.table.query(
                    IndexName="GSI0",
                    KeyConditionExpression=Key("GSI0PK").eq("FLOOR"),
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                items.extend(response.get("Items", []))

            for item in items:
                if str(item.get("id")) == floor_id:
                    return item
            return None
        except ClientError as exc:
            raise UpstreamError(
                f"AWS DynamoDB client error finding floor '{floor_id}': {exc}"
            ) from exc

    def _get_floor_children(
        self, floor_id: str
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        try:
            items = []
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

            rooms = []
            facilities = []
            for item in items:
                gsi0pk = item.get("GSI0PK")
                sk = str(item.get("SK", ""))
                if gsi0pk == "ROOM" or sk.startswith("ROOM#"):
                    rooms.append(_to_dict(item))
                elif gsi0pk == "FACILITY" or sk.startswith("FACILITY#"):
                    facilities.append(_to_dict(item))

            return rooms, facilities
        except ClientError as exc:
            raise UpstreamError(
                f"AWS DynamoDB client error fetching children for floor '{floor_id}': {exc}"
            ) from exc

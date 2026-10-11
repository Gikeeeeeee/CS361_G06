import os
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from errors import UpstreamError


_KEY_ATTRS = {"PK", "SK"} | {
    f"GSI{i}{part}"
    for i in range(7)
    for part in ("PK", "SK")
}


def _convert(value: Any) -> Any:
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)

    if isinstance(value, dict):
        return {k: _convert(v) for k, v in value.items()}

    if isinstance(value, list):
        return [_convert(v) for v in value]

    return value


def _clean(item: dict[str, Any]) -> dict[str, Any]:
    return {
        key: _convert(value)
        for key, value in item.items()
        if key not in _KEY_ATTRS
    }


class DynamoDBEntityReader:
    """อ่าน entity จาก GSI0 โดยไม่พึ่ง BuildingRepository."""

    def __init__(self, table=None, table_name: str | None = None):
        self._table = table
        self.table_name = (
            table_name
            if table_name is not None
            else os.environ.get("DYNAMODB_TABLE_NAME", "")
        )

    @property
    def table(self):
        if self._table is None:
            self._table = boto3.resource("dynamodb").Table(
                self.table_name
            )
        return self._table

    def find_by_id(
        self,
        entity_type: str,
        entity_id: str,
        *,
        match_room_number: bool = False,
    ) -> dict[str, Any] | None:
        """ค้น entity และรองรับ pagination ของ DynamoDB Query."""

        if not self.table_name and self._table is None:
            raise UpstreamError("DYNAMODB_TABLE_NAME is not configured")

        try:
            matches = Attr("id").eq(entity_id)

            if match_room_number:
                matches = matches | Attr("room_number").eq(entity_id)

            items = []
            kwargs = {
                "IndexName": "GSI0",
                "KeyConditionExpression": Key("GSI0PK").eq(entity_type),
                "FilterExpression": matches,
            }

            while True:
                result = self.table.query(**kwargs)
                items.extend(result.get("Items", []))

                last_key = result.get("LastEvaluatedKey")
                if not last_key:
                    break

                kwargs["ExclusiveStartKey"] = last_key

            if not items:
                return None

            return _clean(items[0])

        except ClientError as exc:
            raise UpstreamError(
                f"DynamoDB query failed for {entity_type} '{entity_id}'"
            ) from exc
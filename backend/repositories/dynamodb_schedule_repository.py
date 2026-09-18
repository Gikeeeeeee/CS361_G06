"""
Driven adapter: reads and writes schedules in Amazon DynamoDB.

The only module that knows the single-table layout -- which prefix goes in PK,
which GSI answers which access pattern. It implements
`ports.schedule_source.ScheduleSource` and applies no domain rules.

Layer: driven adapter (outbound).
"""

import os
from typing import Any

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from errors import UpstreamError

# Key attributes are storage layout, not part of the schedule contract, so they
# are stripped on the way out.
_KEY_ATTRS = {"PK", "SK"} | {
    f"GSI{index}{part}" for index in range(7) for part in ("PK", "SK")
}


class DynamoDBScheduleRepository:
    """DynamoDB-backed implementation of the ScheduleSource port."""

    def __init__(self, table_name: str | None = None, table: Any = None):
        # Read env at construction time (not import time), as BuildingRepository
        # does, so tests and the smoke script can point at another table.
        self.table_name = (
            table_name
            if table_name is not None
            else os.environ.get("DYNAMODB_TABLE_NAME", "")
        )
        self._table = table

    @property
    def table(self):
        """Created lazily so importing this module never touches the network."""
        if self._table is None:
            self._table = boto3.resource("dynamodb").Table(self.table_name)
        return self._table

    # -- ScheduleSource ----------------------------------------------------

    def find_by_room_and_time_range(
        self,
        room_id: str,
        start: str,
        end: str,
        schedule_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        AP15: query GSI4 (schedules by room and time).

        ponytail: one page (DynamoDB caps a query at 1MB). Add a paginator when
        a single room holds more than ~1MB of schedules.
        """
        query: dict[str, Any] = {
            "IndexName": "GSI4",
            "KeyConditionExpression": (
                Key("GSI4PK").eq(f"ROOM#{room_id}")
                & Key("GSI4SK").between(start, end)
            ),
        }

        if schedule_type:
            query["FilterExpression"] = Attr("type").eq(str(schedule_type).upper())

        return [self._to_dict(item) for item in self._run(query, "querying")]

    def save(self, schedules: list[dict[str, Any]]) -> None:
        """AP21/AP24: write every occurrence. batch_writer chunks at 25."""
        try:
            with self.table.batch_writer() as batch:
                for schedule in schedules:
                    batch.put_item(Item=self._to_item(schedule))

        except ClientError as exc:
            raise self._upstream(exc, "writing to") from exc

    # -- internals ---------------------------------------------------------

    def _run(self, query: dict[str, Any], action: str) -> list[dict[str, Any]]:
        try:
            return self.table.query(**query).get("Items", [])

        except ClientError as exc:
            raise self._upstream(exc, action) from exc

    def _upstream(self, exc: ClientError, action: str) -> UpstreamError:
        error_code = exc.response.get("Error", {}).get("Code")

        return UpstreamError(
            f"AWS DynamoDB client error [{error_code}] {action} "
            f"table '{self.table_name}'."
        )

    @staticmethod
    def _to_item(schedule: dict[str, Any]) -> dict[str, Any]:
        """A schedule dict -> a single-table item, keys and all."""
        sort = f"{schedule['start_at']}#SCHEDULE#{schedule['id']}"
        room = f"ROOM#{schedule['room_id']}"

        item = {
            **schedule,
            "PK": room,
            "SK": f"SCHEDULE#{schedule['id']}",
            "GSI0PK": "SCHEDULE",
            "GSI0SK": schedule["id"],
            "GSI4PK": room,
            "GSI4SK": sort,
            "GSI6PK": f"TYPE#{schedule['type']}",
            "GSI6SK": sort,
        }

        # GSI5 answers "schedules for this course" -- an activity has no course.
        if schedule.get("course_code"):
            item["GSI5PK"] = f"COURSE#{schedule['course_code']}"
            item["GSI5SK"] = sort

        return {name: value for name, value in item.items() if value is not None}

    @staticmethod
    def _to_dict(item: dict[str, Any]) -> dict[str, Any]:
        """A stored item -> the schedule contract, without the key attributes."""
        return {
            name: value
            for name, value in item.items()
            if name not in _KEY_ATTRS
        }

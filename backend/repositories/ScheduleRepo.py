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
from models.schedule import to_utc
from ports.schedule_source import ScheduleSource

# Key attributes are storage layout, not part of the schedule contract, so they
# are stripped on the way out.
_KEY_ATTRS = {"PK", "SK"} | {
    f"GSI{index}{part}" for index in range(7) for part in ("PK", "SK")
}


class ScheduleRepository(ScheduleSource):
    """DynamoDB-backed implementation of the ScheduleSource port."""

    def __init__(self, table_name: str | None = None, table: Any = None):
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

    @staticmethod
    def _key(room_id: str, schedule_id: str) -> dict[str, str]:
        return {
            "PK": f"ROOM#{room_id}",
            "SK": f"SCHEDULE#{schedule_id}",
        }

    # -- ScheduleSource ----------------------------------------------------

    def find_overlapping(
        self,
        room_id: str,
        start: str,
        end: str,
        schedule_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        AP15: query GSI4 for series that start before `end`, keep those still
        running at `start`.

        ponytail: reads every earlier series of the room and filters. Fine for a
        room's few series per term; add a lower bound on GSI4SK if it grows.
        """
        condition = Attr("series_end_at").gt(start)

        if schedule_type:
            condition &= Attr("type").eq(schedule_type)

        query = {
            "IndexName": "GSI4",
            "KeyConditionExpression": (
                Key("GSI4PK").eq(f"ROOM#{room_id}") & Key("GSI4SK").lt(end)
            ),
            "FilterExpression": condition,
        }

        return [self._to_dict(item) for item in self._run(query)]

    def save_schedule(self, schedule: dict[str, Any]) -> None:
        """AP21/AP22: put the whole item -- create, or replace on PUT."""
        try:
            self.table.put_item(Item=self._to_item(schedule))

        except ClientError as exc:
            raise self._upstream(exc, "writing to") from exc

    def get_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> dict[str, Any] | None:
        """AP13: fetch a single schedule item."""
        try:
            item = self.table.get_item(
                Key=self._key(room_id, schedule_id)
            ).get("Item")

        except ClientError as exc:
            raise self._upstream(exc, "reading from") from exc

        return self._to_dict(item) if item else None

    def delete_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> None:
        """AP23: delete a schedule item."""
        try:
            self.table.delete_item(Key=self._key(room_id, schedule_id))

        except ClientError as exc:
            raise self._upstream(exc, "deleting from") from exc

    # -- internals ---------------------------------------------------------

    def _run(self, query: dict[str, Any]) -> list[dict[str, Any]]:
        """Every page: a FilterExpression can leave page one short or empty."""
        items: list[dict[str, Any]] = []

        try:
            while True:
                page = self.table.query(**query)
                items.extend(page.get("Items", []))

                if "LastEvaluatedKey" not in page:
                    return items

                query["ExclusiveStartKey"] = page["LastEvaluatedKey"]

        except ClientError as exc:
            raise self._upstream(exc, "querying") from exc

    def _upstream(self, exc: ClientError, action: str) -> UpstreamError:
        error_code = exc.response.get("Error", {}).get("Code")

        return UpstreamError(
            f"AWS DynamoDB client error [{error_code}] {action} "
            f"table '{self.table_name}'."
        )

    @staticmethod
    def _to_item(schedule: dict[str, Any]) -> dict[str, Any]:
        """A schedule dict -> a single-table item, keys and all."""
        # UTC, so string order in the sort key is time order across offsets.
        sort = f"{to_utc(schedule['start_at'])}#SCHEDULE#{schedule['id']}"
        room = f"ROOM#{schedule['room_id']}"

        item = {
            **schedule,
            **ScheduleRepository._key(schedule["room_id"], schedule["id"]),
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
        """A stored item -> the schedule, without the key attributes."""
        return {
            name: value
            for name, value in item.items()
            if name not in _KEY_ATTRS
        }

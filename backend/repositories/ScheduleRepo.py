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
        """Map room and schedule id to PK/SK."""
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
        """Find schedules that intersect the time range."""
        # ponytail: reads every earlier series of the room; bound GSI4SK if it grows.
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

    def save_schedules(self, schedules: list[dict[str, Any]]) -> None:
        """CSV import: batch_writer sends 25 items per call and retries leftovers.

        NOTE: BatchWriteItem is NOT transactional. The service rejects the whole
        file before writing, but if DynamoDB fails mid-write, the chunks already
        sent stay saved. Accepted for now: TransactWriteItems caps at 100 actions
        (a file can expand to 2000) and would also mean reworking US1/US2 CRUD.
        If partial imports ever become a real problem, switch to TransactWriteItems.
        """
        try:
            with self.table.batch_writer() as batch:
                for schedule in schedules:
                    batch.put_item(Item=self._to_item(schedule))

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
        """Collect every page of the query."""
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
        """Convert an AWS error to our error so AWS details never reach the client."""
        error_code = exc.response.get("Error", {}).get("Code")

        return UpstreamError(
            f"AWS DynamoDB client error [{error_code}] {action} "
            f"table '{self.table_name}'."
        )

    @staticmethod
    def _to_item(schedule: dict[str, Any]) -> dict[str, Any]:
        """Schedule dict -> DynamoDB single-table item."""
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
        """DynamoDB item -> schedule dict, without PK/SK/GSI keys."""
        return {
            name: value
            for name, value in item.items()
            if name not in _KEY_ATTRS
        }

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

    def get_schedule_by_room_and_time_range(
        self,
        room_id: str,
        start: str,
        end: str,
        schedule_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """AP15: query GSI4 (schedules by room and time)."""
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

    def save_schedule(self, schedules: list[dict[str, Any]]) -> None:
        """AP21/AP24: write every occurrence. batch_writer chunks at 25."""
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
        """Fetch a single schedule item."""
        response = self.table.get_item(
            Key=self._key(room_id, schedule_id)
        )
        item = response.get("Item")
        return self._to_dict(item) if item else None

    def update_schedule(
        self,
        schedule: dict[str, Any],
    ) -> dict[str, Any]:
        """Update a schedule item and maintain its GSI keys."""
        key = self._key(
            schedule["room_id"],
            schedule["id"],
        )

        attributes = self._to_item(schedule)
        attributes.pop("PK", None)
        attributes.pop("SK", None)
        attributes.pop("id", None)

        set_parts = []
        remove_parts = []

        expression_names = {}
        expression_values = {}

        for index, (name, value) in enumerate(attributes.items()):
            name_key = f"#attr{index}"
            value_key = f":value{index}"

            set_parts.append(
                f"{name_key} = {value_key}"
            )

            expression_names[name_key] = name
            expression_values[value_key] = value

        is_course = (
            schedule["type"] == "COURSE"
            and schedule.get("course_code")
        )

        if not is_course:
            expression_names["#gsi5pk"] = "GSI5PK"
            expression_names["#gsi5sk"] = "GSI5SK"

            remove_parts = [
                "#gsi5pk",
                "#gsi5sk",
            ]

        update_expression = "SET " + ", ".join(set_parts)

        if remove_parts:
            update_expression += (
                " REMOVE " + ", ".join(remove_parts)
            )

        response = self.table.update_item(
            Key=key,
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_names,
            ExpressionAttributeValues=expression_values,
            ConditionExpression="attribute_exists(PK)",
            ReturnValues="ALL_NEW",
        )

        return self._to_dict(response["Attributes"])

    def delete_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> None:
        """Delete a schedule item."""
        self.table.delete_item(
            Key=self._key(room_id, schedule_id),
            ConditionExpression="attribute_exists(PK)",
        )

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
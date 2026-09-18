import os
from typing import Any

import boto3

from ports.schedule_source import ScheduleSource


class ScheduleRepository(ScheduleSource):
    def __init__(self, table_name: str | None = None):
        self.table_name = (
            table_name
            or os.environ["DYNAMODB_TABLE_NAME"]
        )

        dynamodb = boto3.resource("dynamodb")
        self.table = dynamodb.Table(self.table_name)

    @staticmethod
    def _key(
        room_id: str,
        schedule_id: str,
    ) -> dict[str, str]:
        return {
            "PK": f"ROOM#{room_id}",
            "SK": f"SCHEDULE#{schedule_id}",
        }

    @staticmethod
    def _index_attributes(
        schedule: dict[str, Any],
    ) -> dict[str, str]:
        start_at = schedule["start_at"]
        schedule_id = schedule["id"]
        room_id = schedule["room_id"]
        schedule_type = schedule["type"]

        attributes = {
            "GSI4PK": f"ROOM#{room_id}",
            "GSI4SK": (
                f"{start_at}#SCHEDULE#{schedule_id}"
            ),
            "GSI6PK": f"TYPE#{schedule_type}",
            "GSI6SK": (
                f"{start_at}#SCHEDULE#{schedule_id}"
            ),
        }

        if (
            schedule_type == "COURSE"
            and schedule.get("course_code")
        ):
            course_code = schedule["course_code"]

            attributes["GSI5PK"] = (
                f"COURSE#{course_code}"
            )
            attributes["GSI5SK"] = (
                f"{start_at}#SCHEDULE#{schedule_id}"
            )

        return attributes

    def get_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> dict[str, Any] | None:
        response = self.table.get_item(
            Key=self._key(room_id, schedule_id)
        )

        return response.get("Item")

    def update_schedule(
        self,
        schedule: dict[str, Any],
    ) -> dict[str, Any]:

        key = self._key(
            schedule["room_id"],
            schedule["id"],
        )

        attributes = {
            **schedule,
            **self._index_attributes(schedule),
        }

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

        return response["Attributes"]
    def delete_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> None:
        self.table.delete_item(
            Key=self._key(room_id, schedule_id),
            ConditionExpression="attribute_exists(PK)",
        )
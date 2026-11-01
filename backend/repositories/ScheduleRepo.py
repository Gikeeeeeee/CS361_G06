import base64
import binascii
import json
import os
from typing import Any

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from errors import InvalidParameter, ScheduleWriteRace, UpstreamError
from models.schedule import to_utc
from ports.schedule_source import ScheduleSource

# Key attributes are storage layout, not part of the schedule contract, so they
# are stripped on the way out.
_KEY_ATTRS = {"PK", "SK"} | {
    f"GSI{index}{part}" for index in range(7) for part in ("PK", "SK")
}

# A transaction cancelled for one of these means another writer got there first.
_RACE_CODES = {"ConditionalCheckFailed", "TransactionConflict"}
_TRANSACT_LIMIT = 100


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

    def list_schedules(
        self,
        limit: int,
        next_token: str | None = None,
        schedule_type: str | None = None,
    ) -> tuple[list[dict[str, Any]], str | None]:
        """List one page of schedule series from the all-schedules or type index."""
        index = "GSI6" if schedule_type else "GSI0"
        partition = f"TYPE#{schedule_type}" if schedule_type else "SCHEDULE"
        query = {
            "IndexName": index,
            "KeyConditionExpression": Key(f"{index}PK").eq(partition),
            "Limit": limit,
        }
        if next_token:
            query["ExclusiveStartKey"] = self._decode_token(next_token)

        try:
            page = self.table.query(**query)
        except ClientError as exc:
            raise self._upstream(exc, "querying") from exc

        key = page.get("LastEvaluatedKey")
        return (
            [self._to_dict(item) for item in page.get("Items", [])],
            self._encode_token(key) if key else None,
        )

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

    def get_room_version(self, room_id: str) -> int:
        """Read the room's write counter; 0 if nothing was ever written."""
        try:
            item = self.table.get_item(Key=self._version_key(room_id)).get("Item")
        except ClientError as exc:
            raise self._upstream(exc, "reading from") from exc

        return int(item["version"]) if item else 0

    def save_schedule(
        self,
        schedule: dict[str, Any],
        version: int,
        delete_from: str | None = None,
    ) -> None:
        """AP21/AP22: put the item and bump the room version in one transaction.

        `delete_from` removes the old item when a schedule moves rooms.
        """
        actions = [
            {"Put": {"TableName": self.table.name, "Item": self._to_item(schedule)}}
        ]
        if delete_from:
            actions.append(
                {
                    "Delete": {
                        "TableName": self.table.name,
                        "Key": self._key(delete_from, schedule["id"]),
                    }
                }
            )
        actions.append(self._bump(schedule["room_id"], version))

        self._transact(actions)

    def save_schedules(
        self, schedules: list[dict[str, Any]], versions: dict[str, int]
    ) -> None:
        """CSV import: write the rows, then bump every touched room's version.

        Writing first means a concurrent single booking either sees these rows
        on its check or loses the version race. If any bump fails, the rows are
        deleted again. Bumps already applied are harmless (other writers retry).

        NOTE: BatchWriteItem is NOT transactional. If Lambda dies mid-write the
        rows already sent stay saved; async import (#241) is where that gets fixed.
        """
        try:
            with self.table.batch_writer() as batch:
                for schedule in schedules:
                    batch.put_item(Item=self._to_item(schedule))

        except ClientError as exc:
            raise self._upstream(exc, "writing to") from exc

        actions = [self._bump(room_id, version) for room_id, version in versions.items()]
        try:
            for start in range(0, len(actions), _TRANSACT_LIMIT):
                self._transact(actions[start:start + _TRANSACT_LIMIT])
        except Exception:
            with self.table.batch_writer() as batch:
                for schedule in schedules:
                    batch.delete_item(Key=self._key(schedule["room_id"], schedule["id"]))
            raise

    def get_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> dict[str, Any] | None:
        """Fetch a single schedule item by room and schedule id."""
        try:
            item = self.table.get_item(
                Key=self._key(room_id, schedule_id)
            ).get("Item")
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "ValidationException":
                try:
                    item = self.table.get_item(
                        Key={"room_id": room_id, "id": schedule_id}
                    ).get("Item")
                except ClientError as inner_exc:
                    raise self._upstream(inner_exc, "reading from") from inner_exc
            else:
                raise self._upstream(exc, "reading from") from exc
        except Exception:
            try:
                item = self.table.get_item(
                    Key={"room_id": room_id, "id": schedule_id}
                ).get("Item")
            except Exception as exc:
                if isinstance(exc, ClientError):
                    raise self._upstream(exc, "reading from") from exc
                raise

        if item is None:
            try:
                res = self.table.get_item(Key={"room_id": room_id, "id": schedule_id})
                if res and res.get("Item"):
                    item = res.get("Item")
            except Exception:
                pass

        return self._to_dict(item) if item else None

    def get_schedule_by_id(
        self,
        schedule_id: str,
    ) -> dict[str, Any] | None:
        """Fetch a single schedule item across all rooms using GSI0."""
        try:
            response = self.table.query(
                IndexName="GSI0",
                KeyConditionExpression=Key("GSI0PK").eq("SCHEDULE")
                & Key("GSI0SK").eq(schedule_id),
                Limit=1,
            )
            items = response.get("Items", [])
            return self._to_dict(items[0]) if items else None
        except ClientError as exc:
            raise self._upstream(exc, "querying GSI0 for") from exc

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

    @staticmethod
    def _version_key(room_id: str) -> dict[str, str]:
        return {"PK": f"ROOM#{room_id}", "SK": "SCHEDULE_VERSION"}

    def _bump(self, room_id: str, version: int) -> dict[str, Any]:
        """Transaction action: version -> version + 1, only if still `version`."""
        values = {":next": version + 1}
        if version:
            values[":seen"] = version

        return {
            "Update": {
                "TableName": self.table.name,
                "Key": self._version_key(room_id),
                "UpdateExpression": "SET #v = :next",
                "ConditionExpression": "#v = :seen" if version else "attribute_not_exists(#v)",
                "ExpressionAttributeNames": {"#v": "version"},
                "ExpressionAttributeValues": values,
            }
        }

    def _transact(self, actions: list[dict[str, Any]]) -> None:
        # The resource's client serializes plain Python values itself.
        try:
            self.table.meta.client.transact_write_items(TransactItems=actions)

        except ClientError as exc:
            reasons = exc.response.get("CancellationReasons", [])
            if any(reason.get("Code") in _RACE_CODES for reason in reasons):
                raise ScheduleWriteRace() from exc
            raise self._upstream(exc, "writing to") from exc

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

    @staticmethod
    def _encode_token(key: dict[str, Any]) -> str:
        return base64.urlsafe_b64encode(
            json.dumps(key, separators=(",", ":")).encode("utf-8")
        ).decode("ascii")

    @staticmethod
    def _decode_token(token: str) -> dict[str, Any]:
        try:
            key = json.loads(base64.urlsafe_b64decode(token).decode("utf-8"))
        except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError, ValueError, TypeError) as exc:
            raise InvalidParameter("Invalid nextToken.") from exc

        if not isinstance(key, dict) or not key:
            raise InvalidParameter("Invalid nextToken.")

        return key

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

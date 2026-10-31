from contextlib import nullcontext
from types import SimpleNamespace

import pytest
from botocore.exceptions import ClientError

from errors import InvalidParameter, ScheduleWriteRace, UpstreamError

from repositories.ScheduleRepo import ScheduleRepository
from boto3.dynamodb.conditions import Equals


class _PagedTable:
    """Stub DynamoDB table: query() serves `pages` in order, put_item records."""

    name = "table"

    def __init__(self, pages=(), cancel=None):
        self.pages = list(pages)
        self.queries = []
        self.put = None
        self.puts = []
        self.deletes = []
        self.transactions = []
        self.cancel = cancel  # CancellationReasons code to fail transactions with
        self.meta = SimpleNamespace(client=self)

    def transact_write_items(self, TransactItems):
        if self.cancel:
            raise ClientError(
                {"Error": {"Code": "TransactionCanceledException"},
                 "CancellationReasons": [{"Code": "None"}, {"Code": self.cancel}]},
                "TransactWriteItems",
            )
        self.transactions.append(TransactItems)

    def delete_item(self, Key):
        self.deletes.append(Key)

    def query(self, **kwargs):
        self.queries.append(dict(kwargs))
        return self.pages.pop(0)

    def put_item(self, Item):
        self.put = Item
        self.puts.append(Item)

    def batch_writer(self):
        return nullcontext(self)


@pytest.mark.unit
def test_list_schedules_queries_gsi0_for_one_page_and_encodes_cursor():
    table = _PagedTable([
        {
            "Items": [{"id": "s1", "PK": "room", "GSI0PK": "SCHEDULE"}],
            "LastEvaluatedKey": {"PK": "room", "SK": "SCHEDULE#s1"},
        }
    ])

    items, next_token = ScheduleRepository(table=table).list_schedules(2)

    assert items == [{"id": "s1"}]
    assert next_token
    assert table.queries[0]["IndexName"] == "GSI0"
    assert table.queries[0]["Limit"] == 2
    assert table.queries[0].get("ExclusiveStartKey") is None


@pytest.mark.unit
def test_list_schedules_decodes_cursor_and_returns_none_on_final_page():
    key = {"PK": "room", "SK": "SCHEDULE#s1"}
    table = _PagedTable([{"Items": [{"id": "s2"}]}])

    items, next_token = ScheduleRepository(table=table).list_schedules(
        2, ScheduleRepository._encode_token(key)
    )

    assert items == [{"id": "s2"}]
    assert next_token is None
    assert table.queries[0]["ExclusiveStartKey"] == key



@pytest.mark.unit
def test_list_schedules_uses_type_index_when_filtered():
    table = _PagedTable([{"Items": [{"id": "s1", "GSI6PK": "TYPE#EXAM"}]}])

    items, next_token = ScheduleRepository(table=table).list_schedules(
        2,
        schedule_type="EXAM",
    )

    assert items == [{"id": "s1"}]
    assert next_token is None
    assert table.queries[0]["IndexName"] == "GSI6"

    expression = table.queries[0]["KeyConditionExpression"]
    assert isinstance(expression, Equals)

    details = expression.get_expression()
    assert details["operator"] == "="
    assert details["values"][0].name == "GSI6PK"
    assert details["values"][1] == "TYPE#EXAM"


@pytest.mark.unit
def test_list_schedules_rejects_invalid_cursor():
    with pytest.raises(InvalidParameter) as exc_info:
        ScheduleRepository(table=_PagedTable()).list_schedules(2, "bad-token")

    assert exc_info.value.code == "INVALID_PARAMETER"


@pytest.mark.unit
def test_find_overlapping_reads_every_page_and_strips_keys():
    table = _PagedTable(
        [
            {"Items": [{"id": "a", "PK": "x", "GSI4SK": "y"}], "LastEvaluatedKey": {"k": 1}},
            {"Items": []},  # a filtered-out page is not the end
            {"Items": [{"id": "b"}]},
        ]
    )
    table.pages[1]["LastEvaluatedKey"] = {"k": 2}

    items = ScheduleRepository(table=table).find_overlapping(
        "r1", "2026-09-16T00:00:00+00:00", "2026-09-17T00:00:00+00:00", "EXAM"
    )

    assert items == [{"id": "a"}, {"id": "b"}]
    assert [q.get("ExclusiveStartKey") for q in table.queries] == [None, {"k": 1}, {"k": 2}]


_SCHEDULE = {"id": "s1", "room_id": "r1", "type": "COURSE", "start_at": "2026-09-16T13:00:00+07:00"}


@pytest.mark.unit
def test_save_schedule_puts_item_and_bumps_room_version_in_one_transaction():
    table = _PagedTable()

    ScheduleRepository(table=table).save_schedule(
        {**_SCHEDULE, "course_code": "CS361", "description": None}, 3
    )

    [(put, bump)] = table.transactions
    item = put["Put"]["Item"]
    assert item["PK"] == "ROOM#r1"
    assert item["SK"] == "SCHEDULE#s1"
    assert item["GSI4SK"] == "2026-09-16T06:00:00+00:00#SCHEDULE#s1"
    assert item["GSI5PK"] == "COURSE#CS361"
    assert item["start_at"] == "2026-09-16T13:00:00+07:00"  # payload untouched
    assert "description" not in item
    assert bump["Update"]["Key"] == {"PK": "ROOM#r1", "SK": "SCHEDULE_VERSION"}
    assert bump["Update"]["ConditionExpression"] == "#v = :seen"
    assert bump["Update"]["ExpressionAttributeValues"] == {":next": 4, ":seen": 3}


@pytest.mark.unit
def test_save_schedule_first_write_requires_no_version_and_moves_rooms_atomically():
    table = _PagedTable()

    ScheduleRepository(table=table).save_schedule(_SCHEDULE, 0, delete_from="r0")

    [(put, delete, bump)] = table.transactions
    assert delete["Delete"]["Key"] == {"PK": "ROOM#r0", "SK": "SCHEDULE#s1"}
    assert bump["Update"]["ConditionExpression"] == "attribute_not_exists(#v)"
    assert ":seen" not in bump["Update"]["ExpressionAttributeValues"]


@pytest.mark.unit
@pytest.mark.parametrize("code", ["ConditionalCheckFailed", "TransactionConflict"])
def test_save_schedule_lost_race_becomes_schedule_write_race(code):
    with pytest.raises(ScheduleWriteRace) as exc:
        ScheduleRepository(table=_PagedTable(cancel=code)).save_schedule(_SCHEDULE, 0)

    assert exc.value.status_code == 409
    assert exc.value.code == "SCHEDULE_CONFLICT"


@pytest.mark.unit
def test_save_schedule_other_cancellation_becomes_upstream_error():
    with pytest.raises(UpstreamError):
        ScheduleRepository(table=_PagedTable(cancel="ThrottlingError")).save_schedule(_SCHEDULE, 0)


@pytest.mark.unit
def test_get_room_version_defaults_to_zero():
    class _VersionTable(_PagedTable):
        def __init__(self, item):
            super().__init__()
            self.item = item

        def get_item(self, Key):
            assert Key == {"PK": "ROOM#r1", "SK": "SCHEDULE_VERSION"}
            return {"Item": self.item} if self.item else {}

    assert ScheduleRepository(table=_VersionTable(None)).get_room_version("r1") == 0
    assert ScheduleRepository(table=_VersionTable({"version": 7})).get_room_version("r1") == 7


@pytest.mark.unit
def test_save_schedules_batches_every_item_then_bumps_each_room():
    table = _PagedTable()

    ScheduleRepository(table=table).save_schedules(
        [_SCHEDULE, {**_SCHEDULE, "id": "s2"}], {"r1": 2}
    )

    assert [item["SK"] for item in table.puts] == ["SCHEDULE#s1", "SCHEDULE#s2"]
    assert table.puts[0]["GSI4SK"] == "2026-09-16T06:00:00+00:00#SCHEDULE#s1"
    [[bump]] = table.transactions
    assert bump["Update"]["Key"]["PK"] == "ROOM#r1"
    assert table.deletes == []


@pytest.mark.unit
def test_save_schedules_lost_race_deletes_the_rows_it_wrote():
    table = _PagedTable(cancel="ConditionalCheckFailed")

    with pytest.raises(ScheduleWriteRace):
        ScheduleRepository(table=table).save_schedules(
            [_SCHEDULE, {**_SCHEDULE, "id": "s2"}], {"r1": 2}
        )

    assert table.deletes == [
        {"PK": "ROOM#r1", "SK": "SCHEDULE#s1"},
        {"PK": "ROOM#r1", "SK": "SCHEDULE#s2"},
    ]


@pytest.mark.unit
def test_save_schedules_client_error_becomes_upstream_error():
    class _FailingTable(_PagedTable):
        def put_item(self, Item):
            raise ClientError({"Error": {"Code": "ProvisionedThroughputExceededException"}}, "BatchWriteItem")

    with pytest.raises(UpstreamError):
        ScheduleRepository(table=_FailingTable()).save_schedules([_SCHEDULE], {"r1": 0})


@pytest.mark.unit
def test_get_schedule_by_id_queries_gsi0():
    table = _PagedTable([
        {
            "Items": [{"id": "s1", "room_id": "r1", "PK": "ROOM#r1", "SK": "SCHEDULE#s1", "GSI0PK": "SCHEDULE", "GSI0SK": "s1"}]
        }
    ])

    item = ScheduleRepository(table=table).get_schedule_by_id("s1")

    assert item == {"id": "s1", "room_id": "r1"}
    assert table.queries[0]["IndexName"] == "GSI0"
    assert table.queries[0]["Limit"] == 1

from contextlib import nullcontext

import pytest
from botocore.exceptions import ClientError

from errors import InvalidParameter, UpstreamError

from repositories.ScheduleRepo import ScheduleRepository


class _PagedTable:
    """Stub DynamoDB table: query() serves `pages` in order, put_item records."""

    def __init__(self, pages=()):
        self.pages = list(pages)
        self.queries = []
        self.put = None
        self.puts = []

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


@pytest.mark.unit
def test_save_schedule_keys_are_utc_and_one_item():
    table = _PagedTable()

    ScheduleRepository(table=table).save_schedule(
        {
            "id": "s1",
            "room_id": "r1",
            "type": "COURSE",
            "course_code": "CS361",
            "start_at": "2026-09-16T13:00:00+07:00",
            "description": None,
        }
    )

    assert table.put["PK"] == "ROOM#r1"
    assert table.put["SK"] == "SCHEDULE#s1"
    assert table.put["GSI4SK"] == "2026-09-16T06:00:00+00:00#SCHEDULE#s1"
    assert table.put["GSI5PK"] == "COURSE#CS361"
    assert table.put["start_at"] == "2026-09-16T13:00:00+07:00"  # payload untouched
    assert "description" not in table.put


@pytest.mark.unit
def test_save_schedules_batches_every_item_with_the_same_keys():
    table = _PagedTable()
    schedule = {"id": "s1", "room_id": "r1", "type": "COURSE", "start_at": "2026-09-16T13:00:00+07:00"}

    ScheduleRepository(table=table).save_schedules([schedule, {**schedule, "id": "s2"}])

    assert [item["SK"] for item in table.puts] == ["SCHEDULE#s1", "SCHEDULE#s2"]
    assert table.puts[0]["GSI4SK"] == "2026-09-16T06:00:00+00:00#SCHEDULE#s1"


@pytest.mark.unit
def test_save_schedules_client_error_becomes_upstream_error():
    class _FailingTable(_PagedTable):
        def put_item(self, Item):
            raise ClientError({"Error": {"Code": "ProvisionedThroughputExceededException"}}, "BatchWriteItem")

    schedule = {"id": "s1", "room_id": "r1", "type": "COURSE", "start_at": "2026-09-16T13:00:00+07:00"}

    with pytest.raises(UpstreamError):
        ScheduleRepository(table=_FailingTable()).save_schedules([schedule])

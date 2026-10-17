import pytest

from errors import AlreadyBookmarked, BookmarkNotFound, InvalidBookmark, MissingParameters
from services.bookmark_service import BookmarkService

USER = "u-1"


@pytest.fixture
def service(fake_bookmark_source):
    return BookmarkService(fake_bookmark_source)


@pytest.mark.unit
def test_add_then_list_newest_first(service):
    service.add_bookmark(USER, {"entity_id": "SCH-1", "entity_type": "SCHEDULE"})
    service.add_bookmark(USER, {"entity_id": "SCH-2", "entity_type": "schedule"})
    service.add_bookmark("other", {"entity_id": "SCH-3", "entity_type": "SCHEDULE"})

    ids = [b.entity_id for b in service.list_bookmarks(USER)]
    assert ids == ["SCH-2", "SCH-1"]


@pytest.mark.unit
def test_add_duplicate_raises_conflict(service):
    service.add_bookmark(USER, {"entity_id": "SCH-1", "entity_type": "SCHEDULE"})
    with pytest.raises(AlreadyBookmarked):
        service.add_bookmark(USER, {"entity_id": "SCH-1", "entity_type": "SCHEDULE"})


@pytest.mark.unit
@pytest.mark.parametrize("body", [
    {"entity_id": "ROOM-204", "entity_type": "UNKNOWN"},
    ["SCH-1"],
])
def test_add_rejects_invalid_type_or_non_object(service, body):
    with pytest.raises(InvalidBookmark):
        service.add_bookmark(USER, body)


@pytest.mark.unit
def test_add_room_bookmark(service):
    bm = service.add_bookmark(USER, {"entity_id": "ROOM-204", "entity_type": "ROOM"})
    assert bm.entity_type == "ROOM"
    assert bm.entity_id == "ROOM-204"


@pytest.mark.unit
def test_add_missing_fields(service):
    with pytest.raises(MissingParameters) as exc:
        service.add_bookmark(USER, {"entity_id": "  "})
    assert exc.value.names == ["entity_id", "entity_type"]


@pytest.mark.unit
def test_remove_returns_row_then_404(service):
    service.add_bookmark(USER, {"entity_id": "SCH-1", "entity_type": "SCHEDULE"})
    assert service.remove_bookmark(USER, "SCH-1").entity_id == "SCH-1"
    with pytest.raises(BookmarkNotFound):
        service.remove_bookmark(USER, "SCH-1")

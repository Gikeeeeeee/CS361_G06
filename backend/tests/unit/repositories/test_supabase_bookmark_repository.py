from unittest.mock import MagicMock, patch

import pytest
import requests

from errors import AlreadyBookmarked, UpstreamError
from repositories.supabase_bookmark_repository import SupabaseBookmarkRepository

ROW = {
    "id": "b1",
    "user_id": "u-1",
    "entity_id": "SCH-9988",
    "entity_type": "SCHEDULE",
    "saved_at": "2026-10-14 10:05:00+00",
}


def _repo():
    return SupabaseBookmarkRepository(supabase_url="https://test.supabase.co", api_key="k")


def _resp(status, body=None):
    resp = MagicMock()
    resp.status_code = status
    resp.json.return_value = body
    return resp


@pytest.mark.unit
def test_list_sends_user_jwt_and_filters_by_user():
    with patch("requests.request", return_value=_resp(200, [ROW])) as req:
        bookmarks = _repo().list_bookmarks("u-1", auth_token="user-jwt")

    assert bookmarks[0].to_dict()["saved_at"] == "2026-10-14T10:05:00Z"
    method, url = req.call_args.args
    kwargs = req.call_args.kwargs
    assert (method, url) == ("GET", "https://test.supabase.co/rest/v1/User_Bookmark")
    assert kwargs["params"]["user_id"] == "eq.u-1"
    assert kwargs["headers"]["Authorization"] == "Bearer user-jwt"


@pytest.mark.unit
def test_add_returns_created_row():
    with patch("requests.request", return_value=_resp(201, [ROW])) as req:
        bookmark = _repo().add_bookmark("u-1", "SCH-9988", "SCHEDULE", auth_token="t")

    assert bookmark.id == "b1"
    assert req.call_args.kwargs["json"] == {
        "user_id": "u-1", "entity_id": "SCH-9988", "entity_type": "SCHEDULE",
    }


@pytest.mark.unit
def test_add_unique_violation_is_already_bookmarked():
    with patch("requests.request", return_value=_resp(409, {"code": "23505"})):
        with pytest.raises(AlreadyBookmarked):
            _repo().add_bookmark("u-1", "SCH-9988", "SCHEDULE")


@pytest.mark.unit
def test_add_fk_violation_is_upstream_not_duplicate():
    with patch("requests.request", return_value=_resp(409, {"code": "23503"})):
        with pytest.raises(UpstreamError):
            _repo().add_bookmark("u-1", "SCH-9988", "SCHEDULE")


@pytest.mark.unit
@pytest.mark.parametrize("body, expected", [([ROW], "b1"), ([], None)])
def test_remove_returns_deleted_row_or_none(body, expected):
    with patch("requests.request", return_value=_resp(200, body)):
        result = _repo().remove_bookmark("u-1", "SCH-9988")
    assert (result.id if result else None) == expected


@pytest.mark.unit
def test_network_error_is_upstream():
    with patch("requests.request", side_effect=requests.ConnectionError("down")):
        with pytest.raises(UpstreamError):
            _repo().list_bookmarks("u-1")

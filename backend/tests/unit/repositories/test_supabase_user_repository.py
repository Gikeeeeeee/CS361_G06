from unittest.mock import patch, MagicMock
import pytest
import requests

from errors import UpstreamError
from repositories.supabase_user_repository import SupabaseUserRepository


@pytest.mark.unit
def test_supabase_repo_returns_user():
    repo = SupabaseUserRepository(
        supabase_url="https://test.supabase.co",
        api_key="test-key",
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [
        {
            "id": "u-123",
            "email": "test@test.com",
            "full_name": "Test Name",
            "role": "STAFF",
            "created_at": "2026-10-14 15:27:00+00",
            "last_login": None,
        }
    ]

    with patch("requests.get", return_value=mock_resp) as mock_get:
        user = repo.get_user_by_id("u-123", auth_token="user-jwt")

        assert user is not None
        assert user.id == "u-123"
        assert user.role == "STAFF"
        mock_get.assert_called_once()
        _, kwargs = mock_get.call_args
        assert kwargs["headers"]["apikey"] == "test-key"
        assert kwargs["headers"]["Authorization"] == "Bearer user-jwt"


@pytest.mark.unit
def test_supabase_repo_empty_records_returns_none():
    repo = SupabaseUserRepository(
        supabase_url="https://test.supabase.co",
        api_key="test-key",
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = []

    with patch("requests.get", return_value=mock_resp):
        user = repo.get_user_by_id("u-missing")
        assert user is None


@pytest.mark.unit
def test_supabase_repo_404_returns_none():
    repo = SupabaseUserRepository(
        supabase_url="https://test.supabase.co",
        api_key="test-key",
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 404

    with patch("requests.get", return_value=mock_resp):
        user = repo.get_user_by_id("u-missing")
        assert user is None


@pytest.mark.unit
def test_supabase_repo_500_raises_upstream_error():
    repo = SupabaseUserRepository(
        supabase_url="https://test.supabase.co",
        api_key="test-key",
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 500
    mock_resp.text = "Internal error"

    with patch("requests.get", return_value=mock_resp):
        with pytest.raises(UpstreamError):
            repo.get_user_by_id("u-123")


@pytest.mark.unit
def test_supabase_repo_connection_failure_raises_upstream_error():
    repo = SupabaseUserRepository(
        supabase_url="https://test.supabase.co",
        api_key="test-key",
    )

    with patch("requests.get", side_effect=requests.RequestException("Timeout")):
        with pytest.raises(UpstreamError):
            repo.get_user_by_id("u-123")

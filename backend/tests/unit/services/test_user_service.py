from unittest.mock import MagicMock
import pytest

from errors import UserNotFound
from models.user import User
from services.user_service import UserService


@pytest.mark.unit
def test_get_profile_success():
    source = MagicMock()
    user = User(
        id="user-123",
        email="test@tu.ac.th",
        full_name="Test User",
        role="STUDENT",
        created_at="2026-10-14T15:27:00Z",
    )
    source.get_user_by_id.return_value = user

    service = UserService(source)
    result = service.get_profile("user-123", auth_token="token-abc")

    assert result == user
    source.get_user_by_id.assert_called_once_with("user-123", auth_token="token-abc")


@pytest.mark.unit
def test_get_profile_not_found():
    source = MagicMock()
    source.get_user_by_id.return_value = None

    service = UserService(source)
    with pytest.raises(UserNotFound) as exc_info:
        service.get_profile("missing-user")

    assert exc_info.value.code == "USER_NOT_FOUND"
    assert "missing-user" in exc_info.value.message

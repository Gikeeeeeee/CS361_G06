import json
import time
from unittest.mock import MagicMock
import jwt
import pytest

import auth
import handler
from models.user import User
from tests.conftest import make_apigw_event

SECRET = "test-secret"


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", SECRET)


def _token(role="STUDENT", user_id="u-123", email="student@dome.tu.ac.th", exp_in=60, secret=SECRET):
    claims = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated",
        "exp": int(time.time()) + exp_in,
        "user_metadata": {"role": role},
    }
    return jwt.encode(claims, secret, algorithm="HS256")


@pytest.fixture
def fake_user_source():
    source = MagicMock()
    user = User(
        id="a1b2c3d4-e5f6-7890-1234-56789abcdef0",
        email="student@dome.tu.ac.th",
        full_name="Tatchakrit Starrat",
        role="STUDENT",
        created_at="2026-10-14 15:27:00+00",
        last_login="2026-10-14 15:27:00+00",
    )
    source.get_user_by_id.return_value = user
    return source


@pytest.mark.unit
@pytest.mark.handler
def test_get_users_me_success_student(monkeypatch, fake_user_source):
    token = _token(role="STUDENT", user_id="a1b2c3d4-e5f6-7890-1234-56789abcdef0")
    event = make_apigw_event(
        method="GET",
        path="/api/v1/users/me",
        route_key="GET /api/v1/users/me",
        headers={"authorization": f"Bearer {token}"},
    )

    deps = handler.Dependencies(user_source=fake_user_source)
    monkeypatch.setattr(handler, "DEPS", deps)

    result = handler.lambda_handler(event, None)
    assert result["statusCode"] == 200

    body = json.loads(result["body"])
    assert body == {
        "success": True,
        "data": {
            "id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
            "email": "student@dome.tu.ac.th",
            "full_name": "Tatchakrit Starrat",
            "role": "STUDENT",
            "created_at": "2026-10-14T15:27:00Z",
            "last_login": "2026-10-14T15:27:00Z",
        },
    }


@pytest.mark.unit
@pytest.mark.handler
def test_get_users_me_success_staff(monkeypatch, fake_user_source):
    staff_user = User(
        id="staff-uuid-99",
        email="staff@dome.tu.ac.th",
        full_name="Staff Member",
        role="STAFF",
        created_at="2026-10-14T15:27:00Z",
        last_login=None,
    )
    fake_user_source.get_user_by_id.return_value = staff_user

    token = _token(role="STAFF", user_id="staff-uuid-99", email="staff@dome.tu.ac.th")
    event = make_apigw_event(
        method="GET",
        path="/api/v1/users/me",
        route_key="GET /api/v1/users/me",
        headers={"authorization": f"Bearer {token}"},
    )

    deps = handler.Dependencies(user_source=fake_user_source)
    monkeypatch.setattr(handler, "DEPS", deps)

    result = handler.lambda_handler(event, None)
    assert result["statusCode"] == 200

    body = json.loads(result["body"])
    assert body["success"] is True
    assert body["data"]["role"] == "STAFF"
    assert body["data"]["id"] == "staff-uuid-99"
    assert body["data"]["last_login"] is None


@pytest.mark.unit
@pytest.mark.handler
@pytest.mark.parametrize("token_header", [
    None,
    "",
    "invalid_bearer",
    "Bearer garbage.token.value",
    "Bearer " + _token(exp_in=-60),
    "Bearer " + _token(secret="wrong-secret"),
])
def test_get_users_me_unauthorized(monkeypatch, fake_user_source, token_header):
    headers = {"authorization": token_header} if token_header is not None else {}
    event = make_apigw_event(
        method="GET",
        path="/api/v1/users/me",
        route_key="GET /api/v1/users/me",
        headers=headers,
    )

    deps = handler.Dependencies(user_source=fake_user_source)
    monkeypatch.setattr(handler, "DEPS", deps)

    result = handler.lambda_handler(event, None)
    assert result["statusCode"] == 401

    body = json.loads(result["body"])
    assert body == {
        "success": False,
        "error": {
            "code": "UNAUTHORIZED",
            "message": "Missing or invalid authentication token.",
        },
    }


@pytest.mark.unit
@pytest.mark.handler
def test_get_users_me_user_not_found(monkeypatch, fake_user_source):
    fake_user_source.get_user_by_id.return_value = None

    token = _token()
    event = make_apigw_event(
        method="GET",
        path="/api/v1/users/me",
        route_key="GET /api/v1/users/me",
        headers={"authorization": f"Bearer {token}"},
    )

    deps = handler.Dependencies(user_source=fake_user_source)
    monkeypatch.setattr(handler, "DEPS", deps)

    result = handler.lambda_handler(event, None)
    assert result["statusCode"] == 404

    body = json.loads(result["body"])
    assert body["success"] is False
    assert body["error"]["code"] == "USER_NOT_FOUND"


@pytest.mark.unit
@pytest.mark.handler
def test_old_unversioned_route_is_404(monkeypatch, fake_user_source):
    token = _token()
    event = make_apigw_event(
        method="GET",
        path="/users/me",
        route_key="GET /users/me",
        headers={"authorization": f"Bearer {token}"},
    )

    deps = handler.Dependencies(user_source=fake_user_source)
    monkeypatch.setattr(handler, "DEPS", deps)

    result = handler.lambda_handler(event, None)
    assert result["statusCode"] == 404
    body = json.loads(result["body"])
    assert body["error"]["code"] == "ROUTE_NOT_FOUND"

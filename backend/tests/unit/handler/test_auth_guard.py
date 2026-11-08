"""API guard: writes need a valid Supabase JWT with role STAFF."""
import time

import jwt
import pytest

import auth
from tests.conftest import make_apigw_event

SECRET = "test-secret"
PATH = "/api/v1/rooms/room-uuid-1/schedules/s1"
KEY = "DELETE /api/v1/rooms/{roomId}/schedules/{scheduleId}"


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", SECRET)


def _token(role, secret=SECRET, exp_in=60):
    claims = {"sub": "u1", "email": "a@test.com", "aud": "authenticated",
              "exp": int(time.time()) + exp_in, "user_metadata": {"role": role}}
    return jwt.encode(claims, secret, algorithm="HS256")


def _delete(token=None):
    headers = {"authorization": f"Bearer {token}"} if token else {}
    return make_apigw_event(method="DELETE", path=PATH, route_key=KEY,
                            path_parameters={"roomId": "room-uuid-1", "scheduleId": "s1"},
                            headers=headers)


@pytest.mark.unit
@pytest.mark.handler
@pytest.mark.parametrize("token", [None, "garbage", "WRONG_SECRET", "EXPIRED"])
def test_missing_or_invalid_token_is_401(invoke_handler, token):
    if token == "WRONG_SECRET":
        token = _token("STAFF", secret="other")
    elif token == "EXPIRED":
        token = _token("STAFF", exp_in=-60)
    assert invoke_handler(_delete(token))["statusCode"] == 401


@pytest.mark.unit
@pytest.mark.handler
def test_student_is_403(invoke_handler):
    assert invoke_handler(_delete(_token("STUDENT")))["statusCode"] == 403


@pytest.mark.unit
@pytest.mark.handler
def test_staff_passes_guard(invoke_handler):
    assert invoke_handler(_delete(_token("STAFF")))["statusCode"] not in (401, 403)


@pytest.mark.unit
@pytest.mark.handler
def test_staff_in_app_metadata_passes_guard(invoke_handler):
    claims = {
        "sub": "u1",
        "email": "staff@test.com",
        "aud": "authenticated",
        "exp": int(time.time()) + 60,
        "app_metadata": {"role": "STAFF"},
        "user_metadata": {"email_verified": True},
    }
    token = jwt.encode(claims, SECRET, algorithm="HS256")
    assert invoke_handler(_delete(token))["statusCode"] not in (401, 403)


@pytest.mark.unit
@pytest.mark.handler
def test_reads_stay_public(invoke_handler):
    event = make_apigw_event(method="GET", path="/api/v1/buildings")
    assert invoke_handler(event)["statusCode"] == 200


# -- CSV import jobs (#241): reading a job is STAFF-only too --------------------

JOB_KEY = "GET /api/v1/schedules/imports/{jobId}"


def _get_job(token=None):
    headers = {"authorization": f"Bearer {token}"} if token else {}
    return make_apigw_event(method="GET", path="/api/v1/schedules/imports/j1", route_key=JOB_KEY,
                            path_parameters={"jobId": "j1"}, headers=headers)


@pytest.mark.unit
@pytest.mark.handler
@pytest.mark.parametrize("role, status", [(None, 401), ("STUDENT", 403), ("STAFF", 404)])
def test_import_job_status_needs_staff(invoke_handler, role, status):
    assert invoke_handler(_get_job(role and _token(role)))["statusCode"] == status


@pytest.mark.unit
@pytest.mark.handler
def test_import_records_who_submitted(invoke_handler, schedule_source):
    csv = ("building,room,type,title,start_at,end_at,course_code,organizer,recurrence_rule\n"
           "LC4,201,COURSE,CS361,2026-10-05T09:00:00+07:00,2026-10-05T12:00:00+07:00,CS361,Dr. A,\n")
    event = make_apigw_event(method="POST", path="/api/v1/schedules/imports",
                             route_key="POST /api/v1/schedules/imports", body=csv,
                             headers={"authorization": f"Bearer {_token('STAFF')}"})

    assert invoke_handler(event)["statusCode"] == 202
    (job,) = schedule_source.jobs.values()
    assert job["created_by"] == "u1"

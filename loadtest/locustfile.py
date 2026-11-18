"""Load test: STUDENT users read (search + room detail), STAFF users create schedules.

User weights 4:1 with equal pacing -> ~80% reads / ~20% writes.

Setup on the test machine:
    pip install locust
    set SUPABASE_URL=https://<project>.supabase.co
    set SUPABASE_ANON_KEY=<anon public key>
    loadtest/users.csv  ->  one "email,password" per line (gitignored).
        Role is read from each account's token; needs at least one STAFF account.

Run:
    locust -f loadtest/locustfile.py --host https://mzg0bnp95l.execute-api.ap-southeast-2.amazonaws.com

Every schedule this creates has a title starting with "LOADTEST-" so it can be cleaned up afterwards.
"""

import base64
import csv
import itertools
import json
import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from locust import HttpUser, between, events, task

SEARCH_TERMS = ["lab", "room", "lc", "classroom", "office", "meeting"]
USERS_FILE = Path(__file__).with_name("users.csv")

room_ids: list[str] = []
pools = {"STUDENT": itertools.cycle([]), "STAFF": itertools.cycle([])}


def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{os.environ['SUPABASE_URL'].rstrip('/')}/auth/v1/token",
        params={"grant_type": "password"},
        headers={"apikey": os.environ["SUPABASE_ANON_KEY"]},
        json={"email": email, "password": password},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _role(token: str) -> str:
    """Same resolution as backend/auth.py; unverified decode is fine, the API verifies."""
    part = token.split(".")[1]
    claims = json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
    app = claims.get("app_metadata") or {}
    user = claims.get("user_metadata") or {}
    return app.get("role") or user.get("role") or "STUDENT"


@events.test_start.add_listener
def _prepare(environment, **_):
    rows = [r[:2] for r in csv.reader(USERS_FILE.open(encoding="utf-8")) if len(r) >= 2]
    by_role = {"STUDENT": [], "STAFF": []}
    for row in rows:
        by_role["STAFF" if _role(_login(*row)) == "STAFF" else "STUDENT"].append(row)
    assert by_role["STAFF"], "need at least one STAFF account in users.csv"
    if not by_role["STUDENT"]:
        by_role["STUDENT"] = by_role["STAFF"]  # staff can read too
    for role, accounts in by_role.items():
        pools[role] = itertools.cycle(accounts)

    room_ids.clear()
    for term in SEARCH_TERMS:
        r = requests.get(
            f"{environment.host}/api/v1/search",
            params={"q": term, "type": "ROOM", "pageSize": 100},
            timeout=30,
        )
        room_ids.extend(x["id"] for x in r.json().get("results", []))
    room_ids[:] = sorted(set(room_ids))
    assert room_ids, "search returned no rooms"
    print(
        f"loadtest: {len(by_role['STUDENT'])} student / {len(by_role['STAFF'])} staff accounts, "
        f"{len(room_ids)} rooms"
    )


class StudentUser(HttpUser):
    weight = 4
    wait_time = between(1, 3)

    @task
    def search(self):
        self.client.get(
            "/api/v1/search",
            params={"q": random.choice(SEARCH_TERMS)},
            name="GET /api/v1/search",
        )

    @task
    def room_detail(self):
        self.client.get(
            f"/api/v1/rooms/{random.choice(room_ids)}",
            name="GET /api/v1/rooms/{roomId}",
        )


class StaffUser(HttpUser):
    weight = 1
    wait_time = between(1, 3)

    def on_start(self):
        # ponytail: token fetched once per simulated user; Supabase JWTs last ~1h, restart the run if longer
        self.token = _login(*next(pools["STAFF"]))

    @task
    def create_schedule(self):
        # Random 1h ACTIVITY slot 1-3 years out: ACTIVITY is allowed in every room type,
        # and the wide window keeps 409 conflicts rare.
        start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        start += timedelta(days=random.randint(365, 3 * 365), hours=random.randint(0, 23))
        body = {
            "type": "ACTIVITY",
            "title": f"LOADTEST-{uuid.uuid4().hex[:8]}",
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(hours=1)).isoformat(),
            "status": "CONFIRM",
        }
        with self.client.post(
            f"/api/v1/rooms/{random.choice(room_ids)}/schedules",
            json=body,
            headers={"Authorization": f"Bearer {self.token}"},
            name="POST /api/v1/rooms/{roomId}/schedules",
            catch_response=True,
        ) as r:
            if r.status_code == 409:
                r.success()  # slot collision is a valid business outcome, not a system failure

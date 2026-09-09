# CS361_G06 — Building Information API

Serverless API for building / floor / room / facility data.
One AWS Lambda (`handler.lambda_handler`) behind an API Gateway HTTP API, reading JSON from S3.
Deployed with Terraform onto an AWS Academy Learner Lab account.

Repo: `Gikeeeeeee/CS361_G06` · Default branch: `main`

---

## Layout

```
backend/                  Python 3.13 Lambda, hexagonal architecture
terraform/
  terraform-backend/      S3 + Lambda + API Gateway  <- deploy from here
  terraform-frontend/     S3 static site
building-data/            source JSON uploaded to S3
frontend/
test-api.ps1              PowerShell smoke test against a deployed endpoint
DeployFlow.md             AWS credential + terraform apply steps
```

`backend/README.md` is the authoritative description of the backend layers.
**Read it before touching backend code.** One thing in it is stale: it says
routes live in `terraform/main.tf`; they actually live in
`terraform/terraform-backend/modules/api_gateway/main.tf`.

---

## The one invariant that breaks everything

A route key exists in **two** places and they must match byte for byte:

| Where | What |
|---|---|
| `backend/handler.py` → `ROUTES` | `"GET /api/v1/buildings/{buildingId}"` |
| `terraform/terraform-backend/modules/api_gateway/main.tf` → `aws_apigatewayv2_route` | `route_key = "GET /api/v1/buildings/{buildingId}"` |

A mismatch produces a 404 that looks like a code bug but is an infra bug.
When adding or renaming a route, change both, and grep to confirm:

```bash
grep -rn "api/v1" backend/handler.py terraform/terraform-backend/modules/api_gateway/main.tf
```

---

## Layering rules (do not violate)

```
API Gateway → handler.py → services/ → ports/ ← repositories/ → S3
              response.py   models/    (interface)  (boto3)
              errors.py
```

- `repositories/` is the **only** module allowed to import `boto3` or know a bucket exists.
- `services/`, `models/`, `ports/` must never import `repositories/`, `handler.py`, or `boto3`.
- Services raise typed errors from `errors.py`. They never return `None` to signal "not found".
- `response.py` is the only place that builds an API Gateway response dict.
- New error messages go in `errors.py`, never inline at the call site.

**Where does my code go?** Knows about HTTP → `handler.py` / `response.py`.
Knows about AWS → `repositories/`. Neither → `services/` or `models/`.

---

## Conventions

- One class per file; filename is the snake_case of the class.
- **Absolute imports only** (`from services.room_service import RoomService`).
  The Lambda task root is on `sys.path`; relative package imports fail there.
- Every new subdirectory needs an `__init__.py` or it is not importable inside
  the Lambda zip.
- 4-space indent; import order stdlib → third-party → local.
- `{buildingId}` is case-insensitive. `{floorId}` accepts `id` or `floor_number`;
  `{roomId}` accepts `id` or `room_number`.

### Error response shape

Every failure, without exception:

```json
{ "error": { "code": "FLOOR_NOT_FOUND", "message": "Floor '9' in building 'LC4' not found" } }
```

| Status | Codes |
|---|---|
| 400 | `MISSING_PARAMETER`, `VALIDATION_ERROR` |
| 404 | `BUILDING_NOT_FOUND`, `FLOOR_NOT_FOUND`, `ROOM_NOT_FOUND`, `FACILITY_NOT_FOUND`, `ROUTE_NOT_FOUND` |
| 502 | `UPSTREAM_ERROR` (S3 unreachable / bad JSON) |
| 500 | `INTERNAL_ERROR` |

---

## Testing

```bash
pip install -r requirements-dev.txt   # pytest + jsonschema, repo root, NOT in the zip
cd backend
pytest                       # whole suite; pytest.ini sets pythonpath=.
pytest tests/unit -q         # fast layer
pytest -k building -q        # one aggregate
```

- `tests/conftest.py` provides `FakeBuildingSource`, `sample_building_raw`,
  and the `fake_source` fixture. **Reuse them — do not build new fakes.**
- Unit tests instantiate a service directly with `fake_source`. No AWS, no mocks of boto3.
- Handler-level tests build a fake API Gateway v2 event and call
  `lambda_handler(event, None)`:

  ```python
  def _event(route_key, **params):
      return {
          "routeKey": route_key,
          "pathParameters": params,
          "requestContext": {"http": {"method": "GET"}},
      }
  ```

**Verify response shape with tests, not with `terraform apply`.** The hexagonal
split exists precisely so a deploy is not needed to check a contract change.
Deploy once per batch of endpoints, at the end.

---

## Deploying

```bash
# credentials: AWS Academy → AWS Details → AWS CLI → Show, export into the shell
aws sts get-caller-identity
cd terraform/terraform-backend
terraform plan
terraform apply -auto-approve
terraform output api_endpoint
```

Full steps in `DeployFlow.md`. Terraform zips the whole `backend/` directory
(`source_dir = ../backend`), so subpackages are picked up automatically.

Never commit `terraform.tfvars`, `*.tfstate`, or `lambda.zip`.
Never run `terraform destroy` unless explicitly asked.

---

## Git workflow

Branch names mirror the API path being worked on, prefixed by change type:

```
feature/api/v1/buildings/buildingId
feature/buildings/buildingId/floors/floorId
refactor/api/v1-ki/buildings/buildingid
infra/re-constrcut-terraform
```

Commit messages name the path and reference the issues they close:

```
api/v1-ki/buildings/buildingid #59 + unit test #52
```

**Always branch before committing.** Never commit directly to `main`.

Use `gh` for all GitHub work (`gh issue create`, `gh issue edit`, `gh pr create`).

---

## Issue map

Two parent issues, and they behave differently:

| Parent | Title | Sub-issues |
|---|---|---|
| **#37** | `US-V1-KI-01: Task: Implement API` | **Created one at a time, as each endpoint is worked on.** |
| **#50** | `KI-TO5` unit tests | **All five already exist (#51–#55).** Never create a new one. |

Route → unit-test sub-issue (these are fixed, look them up, do not guess):

| Route | Test issue |
|---|---|
| `api/v1/buildings` | **#51** |
| `api/v1/buildings/{buildingId}` | **#52** |
| `api/v1/buildings/{buildingId}/floors/{floorId}` | **#53** |
| `api/v1/buildings/{buildingId}/floors/{floorId}/rooms/{roomId}` | **#54** |
| `api/v1/buildings/{buildingId}/floors/{floorId}/facilities/{facilityId}` | **#55** |

Implementation sub-issues created so far: **#58** (`api/v1/buildings`),
**#59** (`/api/v1/buildings/buildingId`).

### Issue body format

Both kinds use the same two headings — match them exactly:

```markdown
## Purpose
<why this endpoint changes — one or two sentences, tied to the contract>

## Scope & DoD
- <file / layer touched>
- [ ] <observable, testable outcome>
```

**Write the DoD before implementing, not after.** Each checkbox should map to a
test that will actually be written. The DoD is the spec; writing it afterwards
is just describing what already happened.

For a unit-test issue (#51–#55), the body is filled in with `gh issue edit`
before writing tests — the issue already exists, only its body is missing.

### Titles

Match the existing siblings rather than inventing a format:

```
US-V1-KI-01: Sub Task: implement /api/v1/buildings/{buildingId}
KI-TO5: Sub Task: Unit Test api/v1/buildings/{buildingId}
```

Run `gh issue view 37` / `gh issue view 50` and copy the style of the nearest
sibling — leading slash and brace usage have drifted between issues.

---

## Known temporary decisions

- **Storage is S3-JSON today, DynamoDB later.** Anything that works around the
  lack of an index (scanning buildings to locate a floor, for example) is
  accepted deliberately, on the condition that it lives in `repositories/`
  behind a port method — so the migration replaces one adapter and nothing
  else. Never let a scan loop leak into `services/`.
- **Routes are being flattened.** `GET /api/v1/floors/{floorId}` replaces
  `GET /api/v1/buildings/{buildingId}/floors/{floorId}`; the old route key is
  renamed, not kept alongside. Rooms and facilities may follow — do not assume
  the nested form is permanent.
- **Path ids are UUIDs.** The frontend sends the floor UUID. `floor_number` is
  no longer an accepted `{floorId}` value, because it is ambiguous once the
  building is out of the path.

---

## Working style in this repo

- Prefer editing existing files over adding new ones; this codebase is
  deliberately small and each layer has one obvious home.
- Adding an endpoint touches ~6 known places — see `/new-endpoint`.
- Do not add dependencies to the Lambda without asking; the zip is deployed
  as-is with no build step.

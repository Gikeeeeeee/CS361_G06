# Backend — Hexagonal Architecture

Serverless API for building / floor / room / facility information.
One AWS Lambda (`handler.lambda_handler`) behind an API Gateway HTTP API, reading JSON from S3.

Resolves **#49** (directory structure) under **#43** (repeated checks in the handler).

---

## Directory and file purposes

| Path | Layer | Purpose | May import |
|---|---|---|---|
| `handler.py` | driving adapter + composition root | Lambda entry point. Resolves the route, validates path params, calls one use case, maps errors to HTTP. **No business rules.** | everything |
| `response.py` | driving adapter | The only place that builds API Gateway responses: status codes, CORS headers, JSON encoding. | `errors` |
| `errors.py` | domain | Error hierarchy. Each error carries the HTTP status the adapter should use. | nothing |
| `ports/building_source.py` | port (owned by the core) | The `BuildingSource` interface the services depend on. | nothing |
| `models/` | domain | Data models and pure rules: `find_floor`, `find_room`, `find_facility`, `room_pin`, `facility_pin`, `Building.summary()`. | `models` |
| `services/` | application | One module per aggregate. Orchestrates the domain, raises typed errors. | `models`, `ports`, `errors` |
| `repositories/building_repository.py` | driven adapter | The **only** module that imports `boto3` or knows a bucket exists. I/O only — no domain filtering, no business rules. Addressing a record by its identifier *is* I/O: `get_floor` finds a floor by uuid, which on S3-JSON means a scan. | `errors` |
| `smoke_local.py` | dev tool | Manual pre-deploy check with fake data, no AWS. Not part of the Lambda package. | everything |

Dependency direction: `handler.py → services/ → ports/ ← repositories/`.
Nothing in `services/`, `models/` or `ports/` imports `repositories/`, `handler.py` or `boto3`.

```
                    inbound                                     outbound
  API Gateway  →  handler.py  →  services/  →  ports/  ←  repositories/  →  S3
                  response.py     models/       (interface)   (boto3)
                                  errors.py
```

**Where does my code go?** Does it know about HTTP? → `handler.py` / `response.py`.
Does it know about AWS? → `repositories/`. Neither? → `services/` or `models/`.

---

## Endpoints

| Route key | Service | 200 response |
|---|---|---|
| `GET /api/v1/buildings` | `BuildingService.list_buildings` | `{"buildings": [...]}` |
| `GET /api/v1/buildings/{buildingId}` | `BuildingService.get_summary` | building + floor metadata |
| `GET /api/v1/floors/{floorId}` | `FloorService.get_details` | floor + presigned SVG URL + room and facility pins — `docs/contract/floor.json` |
| `GET /api/v1/buildings/{buildingId}/floors/{floorId}/rooms/{roomId}` | `RoomService.get_room` | one room record |
| `GET /api/v1/buildings/{buildingId}/floors/{floorId}/facilities/{facilityId}` | `FacilityService.get_facility` | one facility record |

`{buildingId}` is case-insensitive (`lc4` and `LC4` both work).

`{floorId}` on `GET /api/v1/floors/{floorId}` is the floor's `id` (a uuid) and
nothing else — `floor_number` is ambiguous once the building is out of the
path. On the still-nested room and facility routes the building *is* in the
path, so `{floorId}` there still accepts `id` or `floor_number`; that dual
matching lives in `models.floor.find_floor` and goes away when those routes are
flattened too. `{roomId}` accepts `id` or `room_number`.

### Error responses

Every failure has the same shape:

```json
{ "error": { "code": "FLOOR_NOT_FOUND", "message": "Floor '9' in building 'LC4' not found" } }
```

| Status | When |
|---|---|
| 400 `MISSING_PARAMETER` | a required path parameter is absent |
| 404 `BUILDING_NOT_FOUND` / `FLOOR_NOT_FOUND` / `ROOM_NOT_FOUND` / `FACILITY_NOT_FOUND` | resource does not exist |
| 404 `ROUTE_NOT_FOUND` | no route matched |
| 502 `UPSTREAM_ERROR` | S3 unreachable, bucket missing, or stored JSON is invalid |
| 500 `INTERNAL_ERROR` | anything unexpected |

---

## Development flow — adding a new endpoint

1. **Terraform** — add an `aws_apigatewayv2_route` with the new `route_key` in `terraform/terraform-backend/modules/api_gateway/main.tf`.
2. **Model** — add a dataclass or a lookup rule in `models/` if a new domain concept appears.
3. **Port** — only if a genuinely new kind of data access is needed; otherwise reuse `BuildingSource`.
4. **Repository** — implement the new port method. S3 I/O and record addressing only; no domain filtering.
5. **Service** — add a method to the right `*_service.py`. Raise `NotFoundError` / `ValidationError`; never return `None`.
6. **Handler** — add **one entry** to `ROUTES` with its `required_params`. Nothing else changes.
7. **Verify** — add a row to `CHECKS` in `smoke_local.py`, run it, then `curl` the deployed route.

The route key string in `ROUTES` must match the Terraform `route_key` byte for byte.

### Conventions (KI-T06 — reduce merge conflicts)

- One class per file; filename is the snake_case of the class.
- Absolute imports only (`from services.room_service import RoomService`) — the Lambda task root is on `sys.path`, relative package imports fail there.
- Every new subdirectory needs an `__init__.py`, or it will not be importable inside the Lambda package.
- 4-space indentation, stdlib → third-party → local import order.
- Error messages live in `errors.py`, not inline at call sites.

---

## Running locally

```bash
cd backend
python smoke_local.py       # all 5 endpoints against fake data, no AWS needed
```

`smoke_local.py` is a manual sanity check, **not** the unit test suite (tracked separately on #43).

## Deploying

Unchanged — see `DeployFlow.md`. Terraform zips this whole directory (`source_dir = ../backend`) and the entry point is still `handler.lambda_handler`, so subpackages are picked up automatically.

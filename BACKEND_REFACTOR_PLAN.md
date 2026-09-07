# Backend Refactor Plan — Hexagonal Architecture + DRY Handler

**Repo:** `Gikeeeeeee/CS361_G06` · **Base branch:** `v1-known-issue` · **Working branch (suggested):** `refactor/be-hexagonal`
**Issues:** #49 (KI-T05 Sub-Task: แก้ไข Directory Backend Structure) under parent #43 (KI-T05: Handler มี repeated checks จำนวนมาก)
**Scope note:** Unit tests are explicitly **out of scope** for this plan (owned by another team member). The plan does make the code testable — see §8.

---

## 1. Current state

```
backend/
├── handler.py       (7.5 KB)  Lambda entry + CORS + response builder + routing + validation + error handling
├── service.py       (3.8 KB)  BuildingService — 4 use cases
└── repository.py    (4.4 KB)  BuildingRepository — S3 access + one use case (facility lookup)
```

Deployment (from `terraform/main.tf`, unchanged by this refactor):

- `archive_file.lambda_zip` → `source_dir = ../backend` (recursive), `output_path = lambda.zip`
- `aws_lambda_function.building_api` → `runtime = python3.12`, `handler = "handler.lambda_handler"`
- Env: `BUCKET_NAME`, `BUILDINGS_FILE=building-index.json`
- 5 API Gateway HTTP API routes, all pointing at the same Lambda integration:

| # | Route key |
|---|---|
| 1 | `GET /api/v1/buildings` |
| 2 | `GET /api/v1/buildings/{buildingId}` |
| 3 | `GET /api/v1/buildings/{buildingId}/floors/{floorId}` |
| 4 | `GET /api/v1/buildings/{buildingId}/floors/{floorId}/rooms/{roomId}` |
| 5 | `GET /api/v1/buildings/{buildingId}/floors/{floorId}/facilities/{facilityId}` |

---

## 2. What's actually wrong (evidence for #43)

### 2.1 Repetition — the same 5-step block, 4 times

Every endpoint in `handler.py` repeats:

1. `path_params = event.get("pathParameters") or {}`
2. read each id out of it
3. `if not a or not b: return response(400, {"error": "Missing ..."})`
4. call the service
5. `if not result: return response(404, {"error": f"... not found ..."})` → else `return response(200, result)`

That is ~4 near-identical copies, and each copy hand-writes its own 400/404 message. Adding endpoint #6 means copying the block a fifth time — this is exactly the "repeat code ที่เยอะมาก" in #43.

### 2.2 Correctness bugs the repetition is hiding

| # | Location | Problem |
|---|---|---|
| B1 | `handler.py` L172 `if floor_id:` | Dedented out of the `if path.startswith(...)` block. `floor_id` is only bound inside that block → any request that reaches here without matching (e.g. an unrouted path) raises `UnboundLocalError`. |
| B2 | `handler.py` L68, L96 | Routing by substring (`"/floors/" in path and "/rooms/" in path`) instead of by route. Order-dependent and brittle — a future path containing both segments silently hijacks the branch. |
| B3 | `handler.py` L68–L120 | The rooms and facilities branches sit **outside** the `try/except`. An S3 error there escapes the handler → API Gateway returns a raw 502, not the JSON error contract. |
| B4 | `handler.py` L221–L229 | The "Route not found" 404 is unreachable — it follows an unconditional `return`. Unknown routes currently fall through to a 500 or a wrong 404. |
| B5 | `handler.py` | Two error body shapes in use: `{"error": ...}` (new endpoints) and `{"message": ...}` (exception handlers). Frontend can't rely on either. |
| B6 | `repository.py` L104–L106 | `raise e` followed by a dead `raise`. |
| B7 | `repository.py` L100 | Case-insensitive building id implemented as recursion into `get_building_raw(id.upper())` — works, but hides an extra S3 round-trip per lowercase request. |
| B8 | `handler.py` L96 | Rooms branch indented 8 spaces where siblings use 4 — cosmetic, but this is precisely the KI-T06 "structure inconsistency → merge conflict" complaint. |

### 2.3 Layering violations (evidence for #49)

- **Business logic in the repository.** `BuildingRepository.get_facility_info()` walks floors and matches a facility — that's a use case, not data access. Its sibling `get_room_info()` lives in the *service*. Same operation, two different layers → merge conflicts and "where do I put this?" confusion.
- **The floor-lookup rule is written three times.** `match floor where id == floorId or str(floor_number) == floorId` appears in `service.get_floor_details`, `service.get_room_info`, and `repository.get_facility_info`. One rule, three copies, three places to break it.
- **No port.** `BuildingService` imports the concrete `BuildingRepository` directly. Nothing forces the dependency to point inward, so it isn't hexagonal yet — it's three-tier layering.
- **HTTP concerns in the domain path.** CORS headers and `json.dumps` live in `handler.py` alongside routing, so nothing can be exercised without constructing an API Gateway event.

---

## 3. Target architecture

### 3.1 Hexagonal mapping

| Hexagon role | Files | Rule |
|---|---|---|
| **Domain (core)** | `models/`, `errors.py` | Pure Python. No `boto3`, no `json`, no `os.environ`, no HTTP vocabulary. |
| **Application (use cases)** | `services/` | Orchestrates the domain. Depends on the **port**, never on `boto3` or on the concrete repository. |
| **Driving adapter (inbound)** | `handler.py`, `response.py` | Translates an API Gateway event → a use-case call → an HTTP response. Holds zero business rules. |
| **Driven port (outbound)** | `ports/building_source.py` | The interface the core owns: "give me a building's raw data / a map URL". |
| **Driven adapter (outbound)** | `repositories/building_repository.py` | Implements the port using S3/boto3. The *only* file that imports `boto3`. |
| **Composition root** | bottom of `handler.py` | The one place adapters are wired into services. |

Dependency direction: `handler.py → services → ports ← repositories`. Nothing in `services/` or `models/` imports anything from `repositories/` or `handler.py`.

### 3.2 Target directory layout

```
backend/
├── handler.py                     # inbound adapter: route table + dispatch + composition root
├── response.py                    # HTTP response formatting + CORS (one place)
├── errors.py                      # AppError hierarchy → HTTP status mapping
│
├── ports/                         # DEVIATION from the issue example — see §3.3
│   ├── __init__.py
│   └── building_source.py         # BuildingSource protocol (driven port)
│
├── services/                      # application / business logic
│   ├── __init__.py
│   ├── building_service.py        # list_buildings, get_building_summary
│   ├── floor_service.py           # DEVIATION — see §3.3
│   ├── room_service.py
│   └── facility_service.py
│
├── repositories/                  # data access (driven adapter)
│   ├── __init__.py
│   └── building_repository.py     # S3 + presigned URLs; implements BuildingSource
│
└── models/                        # domain models
    ├── __init__.py
    ├── building.py                # Building + floor-summary projection
    ├── floor.py                   # Floor + find_floor(floors, floor_id)  ← the one lookup rule
    ├── room.py
    └── facility.py
```

### 3.3 Deviations from the example in #49 (the issue asks us to explain these)

| Deviation | Why |
|---|---|
| Added `ports/building_source.py` | Without an explicit port, `services/` would import `repositories/` and the dependency arrow would point outward — that is layered, not hexagonal. The port is what makes the architecture match its name, and it is what lets the tests team swap in a fake S3 with no AWS. |
| Added `services/floor_service.py` | The issue lists building/room/facility services; floor details is a distinct use case (it also mints the presigned map URL) and is the largest single piece of logic. Leaving it inside `building_service.py` recreates the god-object problem in a new file. |
| `models/` holds plain dataclasses + one pure `find_floor()` helper | The floor-matching rule (`id` *or* `floor_number`) is a domain rule, not a service detail. Putting it in `models/floor.py` removes all three copies at once. |
| `handler.py` keeps the route table (no separate `router.py`) | Matches the issue's example structure and keeps the whole inbound adapter readable in one screen. If the table outgrows ~30 lines, split it later. |

### 3.4 Endpoint → layer trace (all 5 stay functional)

| Route | Adapter | Service | Port call |
|---|---|---|---|
| `GET /buildings` | `handler` | `BuildingService.list_buildings()` | `list_buildings()` |
| `GET /buildings/{b}` | `handler` | `BuildingService.get_summary(b)` | `get_building(b)` |
| `GET /buildings/{b}/floors/{f}` | `handler` | `FloorService.get_details(b, f)` | `get_building(b)` + `presigned_url(key)` |
| `GET /buildings/{b}/floors/{f}/rooms/{r}` | `handler` | `RoomService.get_room(b, f, r)` | `get_building(b)` |
| `GET /buildings/{b}/floors/{f}/facilities/{fa}` | `handler` | `FacilityService.get_facility(b, f, fa)` | `get_building(b)` |

---

## 4. Killing the repetition in `handler.py` (#43)

Three mechanisms replace the four copied blocks.

### 4.1 A route table keyed on `routeKey`, not on substring matching

API Gateway HTTP API payload v2 already puts the matched route in the event as `event["routeKey"]` — and Terraform already declares exactly the five route keys. Use them as the table key. This deletes all `"/floors/" in path` guessing (fixes **B2**) and gives a real 404 for unknown routes (fixes **B4**).

```python
# handler.py — shape only
Route = namedtuple("Route", "required_params action")

ROUTES = {
    "GET /api/v1/buildings":
        Route((), lambda d, p: {"buildings": d.buildings.list_buildings()}),
    "GET /api/v1/buildings/{buildingId}":
        Route(("buildingId",), lambda d, p: d.buildings.get_summary(p["buildingId"])),
    "GET /api/v1/buildings/{buildingId}/floors/{floorId}":
        Route(("buildingId", "floorId"), lambda d, p: d.floors.get_details(**p)),
    "GET .../rooms/{roomId}":       Route(("buildingId", "floorId", "roomId"),     ...),
    "GET .../facilities/{facilityId}": Route(("buildingId", "floorId", "facilityId"), ...),
}
```

Adding endpoint #6 = one Terraform route + one dict entry + one service method. No copied block.

### 4.2 One validation loop replaces four `if not a or not b` checks

`required_params` drives a single generic check in the dispatcher:

```python
missing = [k for k in route.required_params if not params.get(k)]
if missing:
    raise ValidationError(f"Missing required parameter(s): {', '.join(missing)}")
```

### 4.3 Exceptions instead of `None`-and-check

Services **raise** instead of returning `None`, so the repeated `if not result: return response(404, ...)` disappears entirely and every path lands in one `except`.

```python
# errors.py — shape only
class AppError(Exception):        status_code = 500; code = "INTERNAL_ERROR"
class ValidationError(AppError):  status_code = 400; code = "VALIDATION_ERROR"
class NotFoundError(AppError):    status_code = 404; code = "NOT_FOUND"
class UpstreamError(AppError):    status_code = 502; code = "UPSTREAM_ERROR"

class BuildingNotFound(NotFoundError): ...   # message: "Building 'LC9' not found"
class FloorNotFound(NotFoundError):    ...
class RoomNotFound(NotFoundError):     ...
class FacilityNotFound(NotFoundError): ...
```

Resulting dispatcher — the entire request lifecycle, once:

```python
def lambda_handler(event, context):
    if method(event) == "OPTIONS":
        return response.preflight()
    try:
        route = ROUTES.get(route_key(event))
        if route is None:
            raise NotFoundError(f"Route not found: {route_key(event)}")
        params = validated_params(event, route.required_params)
        return response.ok(route.action(DEPS, params))
    except AppError as e:
        logger.warning("%s: %s", e.code, e)
        return response.error(e)
    except Exception:
        logger.exception("Unhandled error")
        return response.error(AppError("Internal server error"))
```

Everything is now inside the `try` (fixes **B3**), and `floor_id` is never referenced outside its branch (fixes **B1**).

### 4.4 `response.py` — one owner for HTTP shape

`CORS_HEADERS`, `ok(body, status=200)`, `error(app_error)`, `preflight()`. Standardises the error body on **one** shape (fixes **B5**):

```json
{ "error": { "code": "NOT_FOUND", "message": "Floor '9' in building 'LC4' not found" } }
```

> **Contract decision needed before merging.** Success bodies (200) must stay **byte-identical** so `frontend/src/shared/types/api.contracts.ts` and the four `*Service.ts` files keep working. The *error* body shape changes — check whether the frontend reads `error`/`message` today, and if it does, either keep a flat `"message"` alongside the nested object for one release, or land the frontend change in the same PR.

---

## 5. Migration steps (each step leaves the 5 endpoints working)

| Step | Change | Commit | Risk |
|---|---|---|---|
| **0** | Branch `refactor/be-hexagonal` from `origin/v1-known-issue`. Capture a baseline: `curl` all 5 endpoints against the deployed API, save responses to `/tmp/baseline/*.json`. | — | none |
| **1** | Add `errors.py` and `response.py`. Rewire the existing `handler.py` to import `response` instead of its local builder. No behaviour change. | `refactor(be): extract response + errors modules` | low |
| **2** | Create `models/` (`building.py`, `floor.py`, `room.py`, `facility.py`) with dataclasses + `find_floor(floors, floor_id)`. Point the three duplicated floor lookups at it. | `refactor(be): add domain models and single floor lookup` | low |
| **3** | Add `ports/building_source.py`. Move `repository.py` → `repositories/building_repository.py`, make it implement the port, and **move `get_facility_info` logic out of it** into `FacilityService`. Repository keeps only: `list_buildings()`, `get_building(id)`, `presigned_url(key)`. Fix **B6**, and replace the recursive uppercase retry with explicit key-candidate normalisation (**B7**). | `refactor(be): repository implements BuildingSource port` | medium — the facility endpoint changes layers |
| **4** | Split `service.py` → `services/{building,floor,room,facility}_service.py`. Each takes `BuildingSource` via constructor. Convert `return None` → `raise *NotFound`. | `refactor(be): split services by aggregate` | medium |
| **5** | Rewrite `handler.py` as route table + dispatcher + composition root (§4). Delete the dead code at L217–229 and the substring routing. | `refactor(be): DRY handler via route table (#43)` | **highest — do it in its own commit** |
| **6** | Delete the old `service.py` / `repository.py`. Add `backend/__pycache__/` to `.gitignore` and `excludes` on the `archive_file` data source so `.pyc` files stop entering the Lambda zip. | `chore(be): remove legacy modules, exclude pycache from zip` | low |
| **7** | Docs: `backend/README.md` — directory purpose table + "how to add an endpoint" (§7). Satisfies two DoD items on #43. | `docs(be): document backend structure and endpoint flow` | none |
| **8** | `terraform apply`, re-`curl` all 5 endpoints, diff against `/tmp/baseline/*.json`. | — | — |

**Terraform needs no change.** `archive_file` zips `../backend` recursively and `handler.lambda_handler` still resolves. Two constraints follow from that:

- Use **absolute imports** (`from services.building_service import BuildingService`) — the Lambda task root is on `sys.path`, relative package imports will fail.
- Every new subdirectory needs an `__init__.py`.

---

## 6. Definition of Done → this plan

**Issue #49**

- [x] Backend organised in Hexagonal Architecture per the example — §3.2; deviations explained in §3.3 *(paste that table into the PR description)*
- [x] `/api/v1/buildings` functional — §3.4, verified in Step 8
- [x] `/api/v1/buildings/{buildingId}` functional — same
- [x] `/api/v1/buildings/{buildingId}/floors/{floorId}` functional — same
- [x] `.../rooms/{roomId}` functional — same
- [x] `.../facilities/{facilityId}` functional — same (note: moves from repository to service, §5 Step 3)
- [x] Deploy Flow still executable — §5, no Terraform change; `DeployFlow.md` untouched

**Parent issue #43**

- [x] Refactor backend source code — §5
- [x] Eliminate handler repetition — §4
- [x] Implement Hexagonal Architecture — §3
- [x] Document development flow for endpoints/services — §7 (Step 7)
- [x] Document directory and file purposes — §3.2 + Step 7
- [ ] **Unit tests for all 5 endpoints — OUT OF SCOPE here** (other assignee). §8 describes the seams left for them.
- [~] KI-T06 structure inconsistencies → §9 conventions

---

## 7. Development flow — adding a new endpoint (for the docs in Step 7)

1. **Terraform** — add an `aws_apigatewayv2_route` with the new `route_key`.
2. **Model** — add/extend a dataclass in `models/` if a new domain concept appears.
3. **Port** — only if a genuinely new kind of data access is needed; otherwise reuse `BuildingSource`.
4. **Repository** — implement the new port method (S3 I/O only, no filtering rules).
5. **Service** — add a method to the right `*_service.py`; raise `NotFoundError`/`ValidationError`, never return `None`.
6. **Handler** — add one entry to `ROUTES` with its `required_params`. Nothing else.
7. **Verify** — `curl` the new route; add it to the smoke script.

Rule of thumb for "where does this code go?": *does it know about HTTP?* → `handler.py`/`response.py`. *Does it know about AWS?* → `repositories/`. *Neither?* → `services/` or `models/`.

---

## 8. Verifying without unit tests

Unit tests belong to another assignee, so this refactor is validated by **behaviour-preservation checks**:

- **Golden-response diff** — the baseline captured in Step 0, re-run in Step 8. Any non-empty diff on a 200 body is a regression.
- **Local smoke script** (`backend/smoke_local.py`, not a test file) — builds the five API Gateway v2 event dicts and calls `lambda_handler` directly, printing status + body. Run before deploying.
- **Manual matrix** — for each endpoint: happy path, unknown id → 404, missing param → 400, unknown route → 404, `OPTIONS` → 204 with CORS headers.

**Seams deliberately left for the tests team** (so their work needs no further refactor): services take `BuildingSource` by constructor injection → a fake in-memory source replaces S3 with no `boto3` and no AWS credentials; the composition root is a single module-level `DEPS` object in `handler.py` that a test can override; and every error is an `AppError` subclass with a `status_code`, so assertions are on types, not on message strings.

---

## 9. Conventions (addresses KI-T06 merge conflicts)

- One class per file; filename is the snake_case of the class.
- Files stay under ~150 lines; a service that outgrows it splits by aggregate, not by "utils".
- Import order: stdlib → third-party → local, absolute imports only.
- 4-space indent, no exceptions (fixes **B8**).
- New endpoints touch **one line** of the shared `ROUTES` dict — the previous handler had every teammate editing the same 200-line `lambda_handler`, which is what produced the conflicts.
- Error messages are built in `errors.py` subclasses, not inline at call sites, so two people adding endpoints never edit the same string block.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| `routeKey` missing (payload format v1, or a direct-invoke test) | Dispatcher falls back to `method + resource/path` reconstruction; smoke script covers both event shapes. |
| Floor matching by `id` **or** `floor_number` silently lost | It becomes one function, `models/floor.py::find_floor` — cover both forms in the manual matrix (`/floors/1` and `/floors/<uuid>`). |
| Case-insensitive building id (`lc4` → `LC4`) lost in Step 3 | Preserve as an explicit candidate list (`[raw, upper]`) in the repository, and keep `/buildings/lc4` in the manual matrix. |
| Error body shape change breaks the frontend | Decide §4.4 before Step 5; grep the frontend for `.error` / `.message` on failed responses first. |
| Step 5 is the risky one | Isolated commit; if the deploy misbehaves, revert that single commit and the pre-refactor handler still works against the new services. |
| Merge conflicts with the two open `feature/*` branches | Land this early in the sprint and tell teammates to rebase; the file split means their handler edits move rather than conflict line-by-line. |

---

## 11. Effort

Issue #49 estimates 4 h; parent #43 estimates 6 h. Steps 1–8 (excluding unit tests) fit that: Steps 1–2 ~45 min, Step 3 ~60 min, Step 4 ~45 min, Step 5 ~60 min, Steps 6–8 ~60 min.

# Manual backend Terraform dry run

The original manual workflow was based on main at `03ffff6`; the marker-free
fix below is based on latest fetched `origin/main` at `867dad9`. It is intended for a separate
review targeting main, not a merge of PR #288. No workflow was executed and no
AWS/state operation was performed while preparing it.

`.github/workflows/backend-dry-run.yml` supports only `workflow_dispatch` and
only executes its job for `refs/heads/main`. It shares the existing Terraform
concurrency group without cancelling production jobs. It reuses existing AWS
Secret references, `TF_VARS_FILE`, committed backend and default workspace.
No target input, new state or resource identity is introduced.

The workflow prepares the existing Linux Lambda archive locally before AWS
authentication so a cold checkout has the archive source directory required by
Terraform. This reuses `build.py`; it does not run a provisioner or deploy the
ZIP. Docker/dependency availability, unpinned transitive packages and artifact
compatibility remain limitations. A package/hash change is blocked by the guard
until compatible deployment evidence exists; it is not automatically accepted.

Only init/validate/plan and inspection are possible. Plan uses `-lock=false` to
avoid lock writes; exit 0/2 proceed to the guard, other exits fail. Snapshots can
become stale and are never approved for apply. Existing-state/account/region
checks reject missing/conflicting evidence, AWS creates/deletes/replacements,
known async-import deletes and Lambda environment/artifact changes. The local
packaging helper is classified separately under narrow ownership/hash checks.
Guard runtime dependencies are stdlib-only `deployment_guard.py` and
`sandbox_validation.py`, initially copied from PR #288 at `e4ffe1d`. The diagnostic
fix below changes only guard diagnostics/schema checks, not deployment permission.
Pytest is needed only for offline
tests, not to execute the workflow. No frontend or post-deployment checks run.
Sanitized summary/cleanup never upload plans, state, credentials or tfvars.

## Production integration boundary

Existing `.github/workflows/cd.yml`, CI and application code remain unchanged.
The marker-free fix removes only the unused Terraform identity declaration. Pushing
this feature branch does not trigger production CD. No new PR is opened here.

**Do not merge or run this branch automatically.** GitHub must see the new
manual workflow on the default branch before it is available. The existing
production CD still reacts to *any* main push, so merging even a workflow-only
PR could trigger it. An owner-approved installation plan must prevent that
production execution without silently changing production behavior. This task
does not alter default-branch settings or implement a skip/disable workaround.
Keep this PR preparation separate from PR #288 and obtain explicit review.

## Local checks

```text
python -m pytest -q scripts/tests/test_deployment_guard.py scripts/tests/test_manual_backend_dry_run.py -p no:cacheprovider
actionlint -shellcheck= -pyflakes= .github/workflows/backend-dry-run.yml
git diff --check
```

Focused tests: **56 passed**. Actionlint 1.7.12 passes (optional external
ShellCheck/Pyflakes disabled); `git diff --check` passes. Existing production
CD/CI, application and Terraform match the base. These are the original #289
results; the diagnostic fix's focused results are recorded below. No real remote plan or manual run
is proven by local fixtures. Effective IAM/read access, state ownership at run
time, current drift and Lambda package compatibility require authorized AWS
evidence. No actual apply/destroy, S3 write, invalidation, notification or state
repair is provided or permitted.

## Diagnostic fix for guard exit 2

The observed `invalid_or_conflicting_target_evidence` cannot identify the runtime
failure: the previous guard caught every exception with the same result, hiding
invariant failures, missing fields, parse errors and unexpected exceptions.
Workflow inspection confirms JSON stdin, account-output and workspace wiring,
but does not prove the runtime values or which validation failed. No specific
account/state/region incompatibility is assumed or relaxed.

The CLI retains exit 2 as failure and adds static `reason_code` and `phase`:

| Boundary | Example reason codes |
|---|---|
| Account evidence | `AWS_ACCOUNT_EVIDENCE_MISSING`, `AWS_ACCOUNT_EVIDENCE_INVALID`, `PRIOR_STATE_ACCOUNT_MISMATCH` |
| Backend source/metadata | `BACKEND_METADATA_INVALID`, `BACKEND_METADATA_MISMATCH`, `BACKEND_LOCKING_MISMATCH`, `BACKEND_CONFIGURATION_UNSUPPORTED` |
| Workspace | `WORKSPACE_MISMATCH` |
| Region/variables | `VARIABLE_EVIDENCE_INVALID`, `REGION_OR_VARIABLE_MISMATCH`, `PRIOR_STATE_REGION_MISMATCH` |
| Prior-state ownership | `PRIOR_STATE_RESOURCES_MISSING`, `PRIOR_RESOURCE_IDENTITY_INVALID`, `PRIOR_STATE_PLAN_COVERAGE_MISSING` |
| JSON shape | `UNEXPECTED_TERRAFORM_JSON_SCHEMA` |
| Reading/parsing/validation | `PLAN_INPUT_UNAVAILABLE`, `PLAN_JSON_INVALID`, `PLAN_ERRORED`, `PLAN_INCOMPLETE`, `PLAN_DEFERRED`, `PLAN_CHECKS_UNRESOLVED`, `PLAN_VALIDATION_ERROR` |

Public output is limited to static classifications/counts. Even blocked policy
findings no longer print resource addresses/fingerprints. No exception text,
environment values/names, ARNs, identifiers, paths, state/plan values or raw
JSON are emitted. Successful/blocked checks still return 0/1 respectively;
invalid or conflicting evidence always returns 2 with `apply_permitted: false`.
Lambda artifact/environment, local-helper ownership and all drift protections
are preserved. No workflow or Terraform source is changed.

Validation: **92 focused tests passed** (`test_deployment_guard.py` and new
`test_deployment_guard_diagnostics.py`), including each diagnostic boundary,
synthetic malformed/missing inputs, redaction, policy failure and actual CLI
exit 2 through stdin. `git diff --check` passes. Actionlint is unnecessary
because workflows are unchanged; no full suite, build or Terraform command ran.

The exact remaining evidence needed is the sanitized `reason_code` and `phase`
from a separately approved run of this fix, together with its workflow revision.
Do not provide raw plans, state, credentials, environment dumps, ARNs or resource
IDs. No run is dispatched or AWS access performed to collect this evidence here.

## Existing production state: marker-free validation

The reported `DEPLOYMENT_IDENTITY_EVIDENCE_MISSING` came from requiring a
custom bookkeeping resource in prior state, not from missing AWS ownership.
The operator confirmed that this marker exists in no production or sandbox
state. Its declaration and obsolete standalone Terraform test are removed;
no state removal, migration or bootstrap is necessary or performed. The
declaration originated in #272, before V5. If that absence confirmation becomes
invalid, stop: removal would propose a local marker deletion, which the guard
still rejects. No legacy object is exempted from plan safety.

Configure the repository Actions secret `EXPECTED_AWS_ACCOUNT_ID` with the
existing intended account ID through the team's approved secret process.
The workflow fails before credentials when it is absent or malformed; the
guard compares the actual caller against it and checks existing resource
ARN ownership. Neither value is printed. No secret was created or read here.
Backend S3 type, exact bucket/key/region, locking, default workspace, provider
region and resource anchors remain mandatory. The asset-bucket variable must
match the existing bucket identity; its Environment tag, when present, must
match the environment variable. No new metadata is required in old state.

Public categories distinguish `target_identity_validation_failure`,
`plan_validation_failure`, `unsafe_resource_changes` and `validated_plan`.
Exit 2 remains a failure. Creates/deletes/replacements, unreviewed drift,
Lambda code/environment changes and S3/CloudFront identity changes remain
blocked. Only the already-owned local packaging helper retains its narrow
existing exception; this does not approve Lambda artifacts.

Frontend scope: this main-based checkout has no frontend remote backend or
established independent state (operator-confirmed); source configuration alone
does not establish live ownership. Frontend S3/CloudFront configuration is
separate from backend floor-plan objects and remains unchanged. No frontend
infrastructure pipeline is added. Main's existing CI does not yet include the
expanded frontend checks from draft #288. Production `cd.yml` is unchanged.
The repository's live API/browser scripts were not run: they access deployed
services. The corridor Playwright suite intercepts APIs and aborts external
requests. The production build here uses explicit offline fixture settings,
not private `.env` values, and is not a deployment artifact.

Validation: 106 focused Python tests pass across deployment guard, diagnostics
and manual-workflow tests; actionlint passes; backend Terraform fmt and validate
pass using an existing local provider/module cache, without init or state
access (14 existing DynamoDB deprecation warnings). Frontend lint passes with
existing warnings, production build passes with the existing chunk-size
advisory, and all six repository SVG files parse with SVG roots. All 15 mocked
corridor browser tests pass using the existing installed Chromium through
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. The initial default-browser attempt
failed because Playwright's expected browser was absent; the sandboxed retry
stalled during cleanup. The final offline run outside the sandbox passed.
`git diff --check` passes.

The marker requirement no longer prevents full Plan Safety inspection, provided
the expected-account secret and all existing ownership evidence are available.
A fresh authorized remote plan is still needed to establish actual results:
six async-import deletions, Lambda rollback/environment drift and deferred
packaging hashes remain #284 blockers where proposed. No AWS calls, plans,
workflow execution, deployment or remote-state operations occurred here.

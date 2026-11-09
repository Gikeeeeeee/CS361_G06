# Deploy Flow

## Current consolidation for PR #288

The current requirement matrix and run analysis are in
[V5FinalVerification.md](V5FinalVerification.md). This consolidation integrates
main's guard at `c135c16` and the frontend verification/evidence from PR #294
(`ac6783d`) into the existing `feature/v5/ci-validation` branch. Earlier dated
sections below retain their historical findings; their marker/account requirements
and older test counts do not describe the current backend guard.

The existing CI keeps its `main`/`V4`/`V5` PR triggers, locked isolated build,
manifest/integrity verification, retained verification artifact, automation
tests and validation of both Terraform roots. The frontend job now also runs
lint, SVG loading regressions, mocked corridor tests and SVG asset/build-copy
checks. [Run 42639093191](https://github.com/Gikeeeeeee/CS361_G06/actions/runs/42639093191)
failed because its `VITE_API_VERSION=v1` fixture omitted the full `/api/v1`
path expected by `apiClient`. The same failure was reproduced locally without
changing tests; the consolidated CI sets the correct path for Playwright.

PR #288's dry-run CD implementation and receipt-gated post-deployment verifier
are preserved. The only CD adjustment removes an unused account output from the
guard invocation. No custom identity marker or account/ARN scan is required by
the backend guard. Its source and tests match current main; existing backend,
workspace, resource identity, Lambda artifact/environment, IAM, action, drift
and completeness protections remain. The obsolete marker declaration/test are
removed as on main; no Terraform state operation is performed.

The original production CD remains disabled. This feature-branch update neither
dispatches a dry run nor performs deployment, state changes, live verification,
frontend uploads or CloudFront invalidation. The existing verifier remains
preparation for a separately authorized successful deployment.

> **Issue #284 scope:** infrastructure audit only. Application and Terraform
> feature changes from the async-import reconciliation have been reverted to
> V5. Earlier findings describe historical snapshots; the final scope-correction
> section records the current diff, plan and blockers. Do not apply this audit
> branch to the deployed sandbox.

## Prerequisites
1. [Git](https://git-scm.com/)
2. [AWS CLI v2](https://aws.amazon.com/cli/)
3. [Terraform (>= 1.10.0)](https://developer.hashicorp.com/terraform/install)
4. [Docker Desktop](https://www.docker.com/products/docker-desktop/)

Docker must be running when Terraform builds the Lambda package. It provides the
Linux Python 3.12 environment used by AWS Lambda; installing dependencies from
macOS can produce incompatible native binaries.

---

## 1. Current iteration: backend dry run, frontend verification only

The operator confirmed that only Backend has an authoritative remote Terraform
state; there is no established Frontend state to preserve. For this iteration,
do not create/configure/migrate/import frontend state or enable its infrastructure
deployment. This decision supersedes the earlier combined-release boundary in
section 11. The frontend Terraform configuration and private local files remain
unchanged; `terraform.tfvars` alone is not state/ownership evidence.

| Entry point | Current scope |
|---|---|
| `.github/workflows/ci.yml` | Python/automation tests, frontend lint/SVG/mocked browser tests, locked production-mode build, artifact/SVG integrity, formatting and backend-disabled validation of both roots. No deployment credentials. |
| `.github/workflows/cd.yml` | **Backend dry run only**: existing remote backend/default workspace, init, validate, lock-free plan, existing-resource guard and sanitized summary. Main-only trigger unchanged. No apply/destroy or live smoke request. |
| `scripts/sandbox_validation.py` | Optional offline safety/evidence preparation, not deployment or resource discovery. |
| Frontend infrastructure | **Not covered by this dry run**: no frontend init/plan/apply/state, S3 upload, CloudFront invalidation or delivered-object/version checks. |

The redundant separate frontend build workflow remains removed. Frontend
verification stays in the existing CI job, using the same build/integrity
utility and its explicitly labelled reserved fixtures. It does not block backend
plan inspection merely because frontend state does not exist. No separate live
smoke workflow or manual endpoint-selection procedure is introduced.

## 2. Backend CD dry-run flow and existing authority

Main CD retains `push: main`, `TF_WORKSPACE=default`, concurrency and the existing
AWS credential references. Feature/V5 pushes cannot trigger it. This is a code
preparation change: no workflow dispatch, AWS call or refreshed plan is executed
during implementation, and no merge is authorized to obtain a dry-run result.

The future main-triggered dry run checks out the revision, sets up Python and
Terraform 1.15.8, configures existing credentials, writes backend variables from
`TF_VARS_FILE` with private permissions, and runs init/validate/plan in
`terraform/terraform-backend`. Init uses the committed backend/readonly provider
lock; there is no backend override, state repair or migration. The guard compares
resolved metadata to `backend.tf`, binds backend bucket/key/region, workspace,
provider region and asset-bucket variables to existing prior-state resources,
and rejects empty/missing/conflicting state. It does not require a custom marker,
account environment variable or recursive ARN ownership scan.
No frontend state is selected or inferred from its bucket name.

Planning uses `-input=false -lock=false -detailed-exitcode -out=tfplan` to avoid
remote lock writes. Exit 0 (no changes) and 2 (changes) both proceed to inspection;
other exit codes fail. The saved plan is a private, disposable snapshot, never
an apply artifact. Without a lock, concurrent operations can invalidate it; no
deployment/reproducibility claim follows from a passing snapshot.

The guard rejects AWS creates/deletes/replacements, imports/moves/forget,
identity/runtime/IAM/environment changes, changed or deferred Lambda packages,
unreviewed drift and incomplete or
ambiguous evidence. #284's six deletes and Lambda/authentication concerns remain
visible. One narrowly classified local change is reviewed separately: replacement
of the **existing** `module.lambda.terraform_data.build` under the built-in
Terraform provider, with prior-state binding, unchanged null input and changed
known SHA-256 trigger lists. It is reported as local packaging metadata, never
an AWS infrastructure replacement. Missing ownership, wrong provider/address,
unknown/non-hash triggers or input changes still fail. All AWS replacement
protections remain intact, even alongside a recognized helper change. A passing
result explicitly reports `apply_permitted: false`.

There is no apply or live API/SVG step in this iteration. No bypass flag,
resource targeting, additional deployment pipeline or automatic state operation
exists. Restoring actual deployment and post-apply verification requires a
separate reviewed change/approval after the relevant blockers are resolved.

## 3. Dry-run evidence, configuration and cleanup

The always-run job summary records UTC, revision, run URL, backend plan outcome,
detailed exit code and guard result. It explicitly marks apply/post-deployment
verification as not run and frontend infrastructure as out of scope. No endpoint,
secret, tfvars, saved plan or raw state is uploaded or printed by the summary.
An always-run cleanup removes only the generated backend plan/tfvars files from
the ephemeral runner. Failure/skipped inspection is not successful deployment.

Backend inputs remain `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional
`AWS_SESSION_TOKEN` and `TF_VARS_FILE`; their values are neither retrieved nor
changed here. `TF_VARS_FRONTEND` is intentionally unused: frontend Terraform is
not enabled. No additional GitHub configuration is needed for the existing CI
verification-only build. Actual deployment permissions and successful remote
state/plan access remain unverified until an authorized main run.

The frontend's Vite configuration consumes public `VITE_API_BASE_URL`,
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, with existing `/api/v1` version
default. A private local `.env` is not present in a clean Actions checkout. CI
uses explicit reserved test configuration, not silently inferred production
values. No production-configured frontend artifact or backend/Supabase reuse is
claimed. A future real frontend release needs approved public configuration,
but none is requested, created or deployed as part of this dry run.

## 4. Teardown / Cleanup

The shared deployment is not disposable. Do not run automated teardown against
either workspace. DynamoDB has both Terraform `prevent_destroy` and AWS deletion
protection; removing those protections requires a separate, reviewed change.
Other resources do not inherit that protection. Confirm ownership, backups,
dependencies and a reviewed full plan before any separately authorized cleanup.

## 5. Terraform state and drift audit (#284)

Audit date: 2026-11-08. Scope: both Terraform roots, their modules,
`deployment_identity.tf`, CI/CD and this deployment guide. This is an audit of
V5, not authorization to reconcile or redeploy either environment. Local
configuration fixes in this issue do not rename resources, migrate state or
change provider versions.

### State architecture and isolation

| Root / workspace | State ownership and location |
|---|---|
| Backend / `default` | S3 bucket, key and backend region from `terraform/terraform-backend/backend.tf`; shared application state. |
| Backend / `sandbox` | Same state bucket, separate `env:/sandbox/<backend key>` object (implicit S3 workspace prefix). |
| Frontend | No remote backend declared; Terraform defaults to local state. Existing frontend ownership is unverified. Never initialize a new empty state and apply against the existing site. |

The cached backend configuration matches `backend.tf`; the selected local
workspace is `default`. Read-only workspace listing found `default` and
`sandbox`. State snapshots had serials 46 and 37 respectively, written with
Terraform 1.15.8. Serial numbers are independent and do not indicate which
environment is newer. The default and sandbox state objects were last modified
on November 2 and November 8 respectively (UTC).

The AWS caller was the Terraform deployer identity confirmed by the operator.
Account-bearing resource ARNs in both states match that caller's account;
regional resource ARNs match the backend root's local `aws_region`. The backend
region and provider region are independently configured and must both be
verified. Account IDs, ARNs, live endpoints and secrets are intentionally omitted
from this report; use the existing variables and state outputs.

S3 lockfiles are enabled with `use_lockfile = true`, requiring Terraform 1.10+.
The state bucket itself is not declared in either root. Its public-access block
has all four flags enabled, and default encryption reports AES256. Read-only
versioning inspection returned no `Status`; state object metadata returned no
version IDs. **State bucket versioning is not enabled.** Lock acquisition was
not tested because it writes a remote lock object. Bucket location inspection
was denied by an organization service control policy; the operator authorized
continuing permitted checks and recording this gap. Successful state reads
used the configured backend region; they do not substitute for that denied
location check.

Workspace separation isolates state files, not AWS accounts, permissions or
resource names. `deployment_identity.tf` accepts only `default` and `sandbox`
and checks the asset bucket/environment pair. It does not pin the account,
region, project name, DynamoDB table, collection or index. Local sandbox variables
explicitly override the shared DynamoDB and collection defaults. Omitting those
overrides could target shared resources from separate state. The generic backend
example does not satisfy the existing shared bucket guard; it must not be used
as a drop-in configuration for the deployed stack.

### Resource-to-state mapping

Addresses below exist separately within each backend workspace unless noted.
The same address in two state files does not imply the same AWS resource.

| Address / namespace | Ownership, dependencies and evidence |
|---|---|
| `module.storage.*` | Private asset S3 bucket, public-access block, encryption, versioning, CORS, objects, CloudFront distribution/OAC/policies. Names derive from the asset bucket variable; Lambda consumes its bucket and CDN outputs. Default/sandbox bucket IDs differ. |
| `module.dynamodb.aws_dynamodb_table.this` | Managed table, GSIs and stream; explicitly named by `dynamodb_table_name`. Both states contain distinct table IDs. Comments require import for an existing unowned table; they do not perform an import. |
| `module.opensearch.*` | Collection, collection group, network/encryption policies; default VPC is a data lookup. Both states have distinct collection IDs/names. Collection/group naming depends on collection input, not automatically on workspace. Policies use environment-based names. |
| `module.lambda.*` | API and indexer functions, roles, IAM policies/attachments, stream mapping and OpenSearch data-access policy. Functions consume storage, DynamoDB and OpenSearch outputs. Function IDs differ across states. Sandbox also contains an import worker absent from V5 configuration. |
| `module.api_gateway.*` | HTTP API, routes, integration, stage, access logs and Lambda invoke permission. Default/sandbox API IDs differ; integration references the workspace's Lambda output. |
| `aws_sns_topic.alerts`, `aws_cloudwatch_metric_alarm.*` | Per-environment monitoring; alarms reference API, DynamoDB and indexer outputs. |
| `terraform_data.deployment_identity`, `module.lambda.terraform_data.build` | Terraform-only guard and build trigger. Replacing the build helper is not AWS resource replacement, but a later apply would build/deploy code. |
| Frontend `module.s3_website.*` | Separate website bucket, objects, encryption, public-access block, CloudFront/OAC and bucket policy. Not owned by backend state. No authoritative frontend state was available locally for comparison. |

Existing `moved` blocks retain root-to-module address history for storage,
API Gateway and the OpenSearch access policy. They do not discover existing
resources, import missing resources or transfer ownership across workspaces.
The tracked historical state backup predates this audit and contains older
addresses/resources; it is not the source of truth for the current deployment.
Do not restore it or use it as a plan baseline. Review its exposure separately:
Terraform state can contain credentials and application secrets.

### Findings and recommended fixes

| Priority | Finding | Recommended action / potential impact |
|---|---|---|
| High | State bucket has no enabled versioning. Encryption and locking do not provide state history. | Enable versioning through the bucket's authoritative owner in a separate approved change. This preserves future versions, adds storage cost and does not recover prior overwritten state. |
| High | Frontend has no declared shared remote state or verified ownership. | Locate the authoritative frontend state and compare resource IDs before proposing a unique backend key and migration. An empty replacement state can cause duplicate CloudFront resources or bucket-name conflicts. No backend migration performed here. |
| High | Workspace guard covers only bucket/environment; shared table/collection defaults remain possible. | Before every plan, compare account, region and all identity variables with that workspace's authoritative state. Agree an ownership model before adding account/name guards or changing defaults; silent renaming could replace resources. |
| High | Live Lambda code and asset/CDN metadata differ from recorded default state. | Identify the source/version of out-of-band deployments before reconciling. Applying V5 could overwrite newer code or cache behavior. A refreshed plan is evidence, not proof the desired version is correct. |
| High | Sandbox state contains six AWS resources absent from V5; its plan would delete them. | Reconcile V5 with the feature version that owns the import workflow and S3 lifecycle configuration before deploying sandbox. Do not remove them from state to silence the plan. |
| Medium | DynamoDB ignores encryption and tags; public OpenSearch access and a deployer-user principal are configured. | Review ignored fields and service policies separately with their owners. A clean plan cannot establish compliance for ignored fields. Tightening access can interrupt queries/indexing. |
| Medium | DynamoDB is protected; S3, Lambda, API Gateway, OpenSearch and CloudFront have no equivalent Terraform destroy guard. | Keep full plan review mandatory. Assess protection per resource after ownership is settled; blanket lifecycle changes can block legitimate recovery. S3 nonempty-bucket rejection is not protection for Terraform-managed objects. |
| Medium | CD blocks deletes/replacements except Terraform-only resources, but allows creates and in-place code/policy/origin changes. | Retain the existing guard and review all actions before deployment. CD's `default` workspace and main-only trigger do not verify account/region or prevent duplicated resources from empty state. |
| Fixed locally | Backend minimum Terraform version was too old for native S3 locking; CI omitted V5, frontend and formatting. | Raise backend minimum to 1.10; validate both roots on V5 PRs with formatting and backend-disabled initialization using committed provider locks. No infrastructure action required. |

### Commands and evidence

Commands were run from the repository root with Terraform 1.15.8 on Windows.
AWS access initially failed inside the sandbox; identity verification succeeded
outside it. No credential values or raw state were printed or committed.

| Command / inspection | Result |
|---|---|
| `git status --short`, `git branch --show-current` | Clean working tree before work; created `feature/v5/terraform-state-audit` from V5. Git warns that an unrelated pytest cache cannot be enumerated. |
| `terraform version` | 1.15.8. |
| `aws sts get-caller-identity` | Verified deployer identity outside sandbox. |
| `terraform -chdir=terraform/terraform-backend workspace list -no-color` | `default` selected; `sandbox` also exists. |
| `terraform -chdir=terraform/terraform-backend state list -no-color` | Current default resource address inventory read successfully. |
| `terraform -chdir=terraform/terraform-backend state pull` | Read each workspace into memory; emitted only selected resource identities and state metadata. Sandbox used process-scoped `TF_WORKSPACE`, restored afterward. |
| `aws s3api get-bucket-location` using configured state bucket | Denied by organization policy. |
| `aws s3api get-bucket-versioning`, `get-public-access-block`, `get-bucket-encryption`, `head-object` | Results recorded above; bucket/key arguments derived from cached backend configuration. |
| `terraform -chdir=terraform/terraform-backend fmt -check -recursive` | Pass. |
| `terraform -chdir=terraform/terraform-frontend fmt -check -recursive` | Pass. |
| `terraform -chdir=terraform/terraform-backend validate -no-color` | Pass with 14 DynamoDB key-schema deprecation warnings; no schema migration attempted. |
| `terraform -chdir=terraform/terraform-frontend init -backend=false -input=false -lockfile=readonly -no-color` | Installed existing locked provider; no remote backend initialized or lockfile updated. |
| `terraform -chdir=terraform/terraform-frontend validate -no-color` | Pass after initialization; initial attempt reported module not installed. |
| CI YAML parsing and matrix assertions; `git diff --check` | Pass. CI workflow execution itself was not run locally. |

Plans use `-input=false -lock=false -detailed-exitcode -no-color`, with local
`-out` paths under ignored `scratch/`. `terraform show -json` was processed in
memory to inspect actions, replacement paths and refresh drift without printing
secret values. Locking was disabled only for these read-only audits to avoid
remote writes; the backend's lock setting was not changed. Concurrent writes
could invalidate the snapshot, so these plans must never be applied. Saved
plans can contain secrets; both generated audit plans were deleted after review.
The sanitized evidence in this guide is the retained audit record.

Default plan command:

```powershell
terraform -chdir=terraform/terraform-backend plan -input=false -lock=false -detailed-exitcode -no-color '-out=../../scratch/audit-default.tfplan'
```

Default result: exit 2, **3 add / 8 change / 1 destroy**. The create actions are
the deployment identity guard, a replacement build helper and a floor-plan
CloudFront cache policy. The sole destroy action is the Terraform build helper;
**no AWS resource deletion or replacement** is proposed. Updates affect both
Lambda code hashes, the distribution's ordered cache behavior and five SVG
objects' cache metadata. Lambda packaging is deferred until apply, so actual
artifact bytes were not verified by this plan.

Refresh drift was reported for two API routes (`request_models`), the API stage
(`deployment_id`), API Lambda (`code_sha256`, modification time/size), the CDN
(`ordered_cache_behavior`) and five SVG objects (`cache_control`, ETag/version).
Route/stage differences include computed metadata and do not themselves prove
an intentional operator change. The route and stage resources need no action
in the resulting plan. DynamoDB and OpenSearch have no planned default changes;
this does not validate table contents, ignored fields or index documents.

Sandbox plan used the same flags with `'-var-file=sandbox.tfvars'` and output
`../../scratch/audit-sandbox.tfplan`, while `TF_WORKSPACE=sandbox` was set only
for that process and then restored. The first attempt failed argument parsing
(`Too many command line arguments`); quoting the variable-file argument fixed
PowerShell parsing. The successful plan returned exit 2:
**1 add / 20 change / 7 destroy**. One add/destroy pair replaces the local build
helper. Six additional destroy actions affect AWS resources absent from V5:

| Address | Consequence of applying this V5 configuration |
|---|---|
| `module.api_gateway.aws_apigatewayv2_route.get_schedule_import_job` | Removes explicit import-job status route; deployed `$default` routing may still serve it (verified in the follow-up below). |
| `module.lambda.aws_iam_policy.import_jobs` | Deletes import-job access policy. |
| `module.lambda.aws_iam_role_policy_attachment.import_jobs` | Detaches import-job permissions. |
| `module.lambda.aws_lambda_function.import_worker` | Deletes the import worker. |
| `module.lambda.aws_lambda_function_event_invoke_config.import_worker` | Removes worker asynchronous invocation settings. |
| `module.storage.aws_s3_bucket_lifecycle_configuration.this` | Removes bucket lifecycle rules. |

No AWS replacement is proposed. The 20 updates cover two Lambda code hashes
and 18 S3 objects (index, two building JSON files, five SVGs, ten images).
Sandbox refresh drift covers three API routes, the API stage, import-job IAM
policy, API execution role, import worker, asset CDN and bucket metadata.
These observations include computed values; they do not establish who changed
them. **Sandbox is not safe to reconcile from this V5 checkout.** The existing
CD destructive-plan filter would reject the six AWS deletions if presented
with this plan, but CD runs only against `default`.

The selected core resource IDs are distinct across workspaces, but this is not
a full account inventory: unmanaged resources, cross-state ownership outside
these roots and untracked API/data changes remain outside verified coverage.
No DynamoDB item writes, S3 uploads or OpenSearch indexing were performed.

References: [S3 backend/workspace and lockfile behavior](https://developer.hashicorp.com/terraform/language/backend/s3),
[Terraform plan modes and options](https://developer.hashicorp.com/terraform/cli/commands/plan),
[AWS guidance on S3 locking and versioning](https://docs.aws.amazon.com/prescriptive-guidance/latest/terraform-aws-provider-best-practices/backend.html).

Frontend planning is intentionally withheld: existing state/backend/workspace
ownership and provider target region were not established. No `apply`,
`destroy`, `refresh`, import, state mutation, workspace creation, migration,
commit, push or deployment was executed.

### Follow-up: six sandbox deletion candidates (#284)

Investigation date: 2026-11-08; the usage window ended at 21:49 Asia/Bangkok.
This follow-up inspects the sandbox only. The working branch remains
`feature/v5/terraform-state-audit`; the initial audit is already recorded in
commit `ad1e03b`. No infrastructure configuration, Git history or state was
changed during this investigation. All six resources are **confirmed present
in both sandbox state and AWS**. None is established as obsolete.

#### Root cause and Git evidence

All six definitions first appear in available history in
[`9a928ae`](https://github.com/Gikeeeeeee/CS361_G06/commit/9a928ae694504f0b40ca039d0e2b3824c30e4e98),
`refactor: run bulk CSV schedule import as a background job (#241)`.
The local remote-tracking branch containing it is
`origin/refactor/async-csv-import-241`. Its parent is `03ffff6`, also the common
ancestor with V5. `git log V5..origin/refactor/async-csv-import-241` shows that
single feature commit. `git merge-base --is-ancestor 9a928ae V5` returns 1:
the async-import commit is not included in V5. The repository is not shallow.

`git log --all -G 'import_worker|import_jobs|get_schedule_import_job|aws_s3_bucket_lifecycle_configuration' -- terraform/terraform-backend`
finds that introduction commit, with no subsequent removal in available
history. This is **an unintegrated feature/configuration mismatch**, not an
intentional resource-removal commit in V5. Available local refs cannot prove
unrecorded operator intent or the current status of a remote pull request.

Sandbox state serial 37 contains every candidate at the exact address listed
below. V5 contains none of their resource blocks and no alternate-address
migration for them. Terraform therefore interprets the existing managed
objects as resources to destroy to match V5, rather than as replacements due
to changed names. The earlier full refreshed plan proposed six AWS deletes
plus the unrelated Terraform build-helper replacement. No new plan was needed
for this follow-up; state and AWS were inspected directly.

Crucially, this is not only leftover state: deployed worker source files
`handler.py`, `services/schedule_import_service.py`,
`repositories/ScheduleRepo.py` and `indexer/service.py` exactly match the
introduction commit after normalizing line endings, and differ from V5.
The deployed API and worker ZIP code hashes match each other. Each deployed
function's code hash also matches its sandbox state record. This verifies the
relevant async-import implementation is deployed; it does not attribute the
deployment to a particular person or Git workflow.

#### AWS identities, activity and dependency chain

Every lookup used identifiers read from sandbox state, not literal AWS resource
names, account IDs or ARNs. The caller account was compared in memory with the
worker's state ARN. The raw state, Lambda environment values, signed ZIP URL,
ZIP bytes, object keys, job IDs and account identifiers were not emitted or
written to the report. Identity mappings below are relational so they remain
usable without duplicating environment-specific values.

| Terraform address | AWS identity verified from state | Read-only AWS evidence |
|---|---|---|
| `module.api_gateway.aws_apigatewayv2_route.get_schedule_import_job` | State `api_id` + route `id` | `get-route`: `GET /api/v1/schedules/imports/{jobId}`, integration targets the state API Lambda. |
| `module.lambda.aws_iam_policy.import_jobs` | State policy ARN and current default policy version | `get-policy` / `get-policy-version`: S3 Put/Get for this bucket's `imports/*`; InvokeFunction for this worker. |
| `module.lambda.aws_iam_role_policy_attachment.import_jobs` | State role + policy ARN | `list-attached-role-policies` confirms that pair; `list-entities-for-policy` reports one role, no users/groups. |
| `module.lambda.aws_lambda_function.import_worker` | State function name / ARN | `get-function-configuration`: Active, `handler.import_worker`, 300-second timeout, shares the API execution role. API `IMPORT_WORKER_NAME` equals this function. |
| `module.lambda.aws_lambda_function_event_invoke_config.import_worker` | State function-scoped async configuration | `get-function-event-invoke-config`: two retries, maximum event age 3,600 seconds. |
| `module.storage.aws_s3_bucket_lifecycle_configuration.this` | State asset bucket's lifecycle configuration | `get-bucket-lifecycle-configuration`: one Enabled rule, `imports/` prefix, current expiration after one day and noncurrent-version expiration after one day. |

CloudWatch `AWS/Lambda` FunctionName metrics were queried with one-hour periods
over November 1 21:49 through November 8 21:49 Asia/Bangkok (14:49 UTC).
Worker totals: **6 Invocations, 0 Errors, 0 Throttles**, with a nonzero invocation
datapoint on November 8. These are invocation counts, not counts of successful
imports. The service catches application failures and records job outcomes,
so zero Lambda Errors is compatible with failed import jobs. No live function
was invoked and no CSV request was submitted for this investigation.

Metadata-only S3 inventory found **12 current import objects**: six CSV files
and six result JSON files, 11,657 bytes total; 12 versions and no delete markers.
The oldest current object's modification time was November 8 21:10:06
Asia/Bangkok. The asset bucket has versioning Enabled, unlike the separate
state bucket. Only the `imports/` prefix matches the inspected lifecycle rule:
building JSON, SVG floor plans and images outside that prefix are unaffected.

A DynamoDB scan projected only status/expiry/dry-run/attempt metadata for
`IMPORT_JOB#` items; no item contents or identifiers were printed. It found
six jobs: **3 COMPLETED, 3 FAILED**, including three dry-run jobs. TTL is Enabled
on `expires_at`. These counts are point-in-time evidence; neither TTL nor S3
lifecycle expiry runs at an exact wall-clock deadline, and the inventory may
change after this audit. No pending/processing job was observed in this scan;
that does not establish an empty Lambda async queue or make the worker obsolete.

Verified application flow in the deployed source:

1. STAFF `POST /api/v1/schedules/imports` calls `submit()`, validates the file,
   stores `imports/<job>.csv`, creates a PENDING DynamoDB item, invokes the worker
   asynchronously (`InvocationType=Event`) and returns HTTP 202 plus job status.
2. `handler.import_worker` calls `run_job()`. The worker claims a lease, reads
   the CSV, imports or previews schedules, writes `imports/<job>.result.json`,
   and records COMPLETED/FAILED. Stable imported-schedule IDs and job leases
   support retries. Failed non-dry-run work attempts to clean its schedule rows.
3. STAFF `GET /api/v1/schedules/imports/{jobId}` calls `get_job()`, reads job
   metadata and, for terminal jobs, reads result/error JSON from S3.
4. Job items use a one-day expiry and staged CSV/results use one-day S3 cleanup.
   Imported schedule rows are separate records; they are not the S3 objects
   matched by the lifecycle rule. Removing the rule does not delete schedules.

Current V5 source instead calls synchronous `import_csv()` and lacks the worker
entry point and job-status contract. The V5 frontend service/form expects
immediate `rows`/`created` responses and has no job polling. This is a separate
client/API compatibility risk; lack of a polling client in V5 does not make
the deployed backend's worker or stored job data obsolete. The deployed
frontend version and external API consumers were not established in this audit.

#### Resource-by-resource risk and recommendation

Classifications describe the deployed async-import behavior and retention
contract; they do not decide whether that architecture should be kept.

| Terraform address | Existence / classification | Dependencies and deletion impact | Usage evidence / recommended action |
|---|---|---|---|
| `module.api_gateway.aws_apigatewayv2_route.get_schedule_import_job` | Confirmed / **Unknown** whether the explicit route is indispensable | Purpose: explicit job-status routing to API Lambda. The deployed `$default` route targets the same integration, and the deployed handler falls back to method/path matching. Deleting this route alone need not break polling. Applying V5's handler as well removes the status implementation, which would break that contract. | Existing route and six job records confirmed; no per-route request history queried. Retain until the owner explicitly chooses dedicated routing versus fallback; no evidence supports treating it as obsolete. |
| `module.lambda.aws_iam_policy.import_jobs` | Confirmed / **Required** for configured async-import grants | Purpose: stage/read job files and invoke worker. API submission needs PutObject and InvokeFunction; worker writes result JSON; status reads use GetObject. Removing its grants can fail submissions/result writes and leave incomplete jobs. Existing broader S3-read policy means GetObject is not exclusively supplied here. | Policy document scopes both resources correctly and is attached to one role used by API/worker; six invocations and stored CSV/results show the workflow has run. Retain policy; no full effective-IAM simulation or proof of absence of alternative grants was performed. |
| `module.lambda.aws_iam_role_policy_attachment.import_jobs` | Confirmed / **Required** | Purpose: give the shared execution role the import-job grants. Detaching has the same permission-loss risk even if the policy object remains. | Exact state role/policy relationship confirmed live; API and worker share that role. Retain attachment with the policy. |
| `module.lambda.aws_lambda_function.import_worker` | Confirmed / **Required** | Purpose: process imports beyond the API request deadline. API dispatch points to it. Deletion breaks future async processing; queued/retried jobs could stop and partial schedule work could miss completion/cleanup. Existing completed schedule data is not automatically removed by deleting the function. | Active deployed async source, six recent invocations, and CSV/results/job rows confirmed. Retain; do not redeploy V5's ZIP to this handler because V5 lacks `handler.import_worker`. |
| `module.lambda.aws_lambda_function_event_invoke_config.import_worker` | Confirmed / **Required** for the configured retry/age policy | Purpose: bound asynchronous retry age to one hour with two error retries. Removing this setting alone does not delete the function or disable async invokes; Lambda defaults still allow two retries and up to six-hour event age, changing the explicit retry/lease timing assumptions. | Live settings confirmed; invocation activity is worker-level, not proof that retries occurred. Retain until retry/lease policy is reviewed. |
| `module.storage.aws_s3_bucket_lifecycle_configuration.this` | Confirmed / **Required** for the configured retention policy | Purpose: expire staged CSV/results and noncurrent versions after one day. Removing the configuration stops managed cleanup, retains potentially sensitive import files/results and increases storage. It does not itself delete the bucket, current files or DynamoDB schedule rows, nor restore expired objects. Already-scheduled expiration timing is not guaranteed to reverse immediately. | Enabled prefix rule, 12 current objects and versioning confirmed. Retain the cleanup contract unless a replacement retention decision is approved. |

AWS default retry behavior and versioned S3 expiration semantics were checked
against [Lambda async error handling](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-error-handling.html),
[maximum event age](https://aws.amazon.com/about-aws/whats-new/2019/11/aws-lambda-supports-max-retry-attempts-event-age-asynchronous-invocations/)
and [S3 expiration rules](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-expire-general-considerations.html).

#### Investigation commands and limits

Git inspection: `git status --short`, `git branch --show-current`,
`git log --all -G ...`, `git log --all -S get_schedule_import_job`,
`git branch -a --contains 9a928ae`, `git merge-base`,
`git merge-base --is-ancestor`, `git rev-parse --is-shallow-repository`,
`git show 9a928ae` and `git show 9a928ae:backend/<file>`.
`rg` and source reads covered backend handler/service/repository, Terraform
modules and frontend import service/form. No checkout, fetch, merge or rewrite
was performed.

AWS inspection: process-scoped `TF_WORKSPACE=sandbox terraform state pull`,
STS identity comparison, API Gateway `get-route`, `get-routes`, `get-integration`,
IAM `get-policy`, `get-policy-version`, `list-attached-role-policies`,
`list-entities-for-policy`, Lambda `get-function-configuration`, `get-function`,
`get-function-event-invoke-config`, CloudWatch `get-metric-statistics`,
S3 `get-bucket-lifecycle-configuration`, `get-bucket-versioning`,
`list-objects-v2`, `list-object-versions`, DynamoDB `describe-time-to-live`
and metadata-projected `scan`. All completed successfully for this sandbox
investigation; no additional permission gap was encountered. The function ZIP
was downloaded through its temporary read URL and inspected only in memory.
No CloudWatch logs, CSV contents, job IDs or user records were retrieved.
The local selected Terraform workspace remained unchanged.

No Terraform configuration was modified, so fmt/validate and a new plan were
not necessary for this documentation-only follow-up. `git diff --check` is the
local documentation check. The earlier state-bucket location denial and
frontend state-ownership gap remain unresolved; the prior authorization to
record those gaps does not establish that they were verified.

#### Resolution decision and blockers to closing #284

The six deletes are an expected consequence of giving Terraform the older V5
configuration, but **are not justified as intended decommissioning**. The
evidence supports retaining the deployed workflow while ownership is decided.
Do not use targeted applies, imports, state removal or manual resource-name
changes to conceal the mismatch.

An owner decision is required before reconciliation: should sandbox continue
to represent the async-import feature, with its code and infrastructure brought
into the intended integration baseline together, or is a deliberate return to
synchronous V5 behavior intended? The latter needs a reviewed API/client
rollback, job/queue drain and retention plan. This investigation does not
authorize or implement either option.

Closing #284 still requires that decision, alignment of the chosen application
and Terraform baseline, and a newly reviewed full sandbox plan with all
deletes/replacements explained. The separate frontend state-ownership gap,
state-bucket versioning recommendation, denied state-bucket location check and
incomplete account/region identity guard remain tracked in the original audit.
No work on #281 was performed.

### Scope correction: infrastructure audit only (#284)

The operator clarified that #284 covers state, workspace isolation, drift and
reproducibility, without integrating application features. The prior async
reconciliation was out of scope and has been reverted locally. Its implementation
and test results are not acceptance evidence for the current branch. The earlier
investigation above remains evidence of deployed sandbox ownership and use.

The operator explicitly approved restoring the five async Terraform feature
files to V5 as well. Keeping those definitions tied to this checkout's Lambda
archive would permit deployment of V5 code to an async worker whose handler is
absent from V5. Restoring local configuration does not delete AWS resources:
no apply, state edit, import, migration or resource operation was performed.
The resulting destructive plan is audit evidence and a deployment blocker.

#### Files restored and audit changes retained

Exactly these application files were restored to their V5 versions:

| Area | Files restored |
|---|---|
| Backend application | `backend/README.md`, `backend/errors.py`, `backend/handler.py`, `backend/indexer/service.py`, `backend/models/schedule.py`, `backend/ports/schedule_source.py`, `backend/repositories/ScheduleRepo.py`, `backend/services/schedule_import_service.py`, `backend/services/schedule_service.py` |
| Backend tests | `backend/tests/conftest.py`, `backend/tests/integration/test_api_contract.py`, `backend/tests/unit/handler/test_auth_guard.py`, `backend/tests/unit/handler/test_schedule_routes.py`, `backend/tests/unit/indexer/test_mapper.py`, `backend/tests/unit/repositories/test_schedule_repository.py`, `backend/tests/unit/services/test_schedule_import_service.py` |
| Frontend | `frontend/package.json`, `frontend/src/features/admin-add-schedule/services/csvScheduleService.ts`, `frontend/src/features/admin-add-schedule/admin-import-file/CsvImportForm.tsx` |

The reconciliation-only untracked test `frontend/test_csv_import_async.mjs` was
removed. Pre-existing V5 application functionality and tests were preserved.
No service-layer feature audit fixes were introduced after the scope correction.

These five Terraform files were restored to V5 with explicit operator approval:
`modules/api_gateway/main.tf`, `modules/dynamodb/main.tf`,
`modules/lambda/main.tf`, `modules/lambda/outputs.tf`, and
`modules/storage/main.tf`, all under `terraform/terraform-backend/`.
No resource identity was renamed, and no state address was edited.

The complete tracked diff against V5 now contains only three files:

| File | Retained change |
|---|---|
| `.github/workflows/ci.yml` | Include V5 PRs, validate both Terraform roots, check recursive formatting, initialize without backend access using existing provider locks. |
| `terraform/terraform-backend/main.tf` | Raise minimum Terraform to 1.10 for the already-configured S3 lockfile support. |
| `DeployFlow.md` | Audit architecture, ownership, risks, read-only evidence, scope correction and deployment blockers; matching prerequisite version and removal of automatic destructive teardown guidance. |

`git diff --exit-code V5 -- backend frontend terraform/terraform-backend/modules`
passes. There is no application or module feature diff against V5 and no newly
added application file remains. A local ignored backup of the reverted diff
was retained for traceability; it is not a deployable change or tracked artifact.

#### Validation and current plan

Both Terraform roots pass `fmt -check -recursive` and `validate -no-color`.
Backend validation still reports the 14 existing DynamoDB deprecation warnings.
CI YAML parsing, V5 branch coverage, the two-root matrix and validation commands
pass local assertions; GitHub Actions itself was not run. The restored backend
non-API suite passes 361 tests with 38 deselected. `git diff --check` passes.
The restored V5 frontend production build also passes; this replaces the
locally generated async-feature bundle without changing application source.
The existing Vite large-chunk advisory remains.
No live application tests or API invocations were performed.

The previous reconciled plan with zero AWS deletions depended on now-reverted
feature definitions and is **not the plan for this audit-only branch**. It is
withdrawn as evidence that this branch can safely deploy to sandbox. The prior
source-equivalence claim concerned the feature implementation, not V5's restored
application source.

Fresh sandbox plan results and the remaining acceptance blockers are recorded
below. No plan from this audit is approved to apply.

The target was verified before planning: process-scoped `TF_WORKSPACE=sandbox`,
state serial 37, caller account compared in memory with the worker's state ARN,
provider region and bucket/table/collection/worker identity compared with the
sandbox inputs, and cached backend settings compared with `backend.tf`. The
selected local workspace remained `default`. No account IDs, ARNs, credentials
or raw environment values were emitted.

The plan used `sandbox.tfvars` and the previously approved private temporary
override preserving deployed Supabase values. API and worker settings were
checked equal before populating that override; its ACL was restricted to the
current Windows user, and it was deleted immediately after planning. This
isolates the V5/configuration mismatch from the already documented local
Supabase-input mismatch, without modifying existing tfvars or live settings.

Command shape (from repository root):

```powershell
terraform -chdir=terraform/terraform-backend plan '-var-file=sandbox.tfvars' '-var-file=<temporary-private-live-settings-override>' -input=false -lock=false -detailed-exitcode -no-color '-out=../../scratch/issue284-scope-correction/sandbox.tfplan'
```

Result: exit 2, **1 add / 20 change / 7 destroy**. Each action and changed field
was inspected through plan JSON. The plan was refreshed after restoring Git's
configured working-tree line endings because Terraform hashes file bytes.

| Planned actions | Impact / conclusion |
|---|---|
| Six AWS deletes | All six previously investigated resources: `module.api_gateway.aws_apigatewayv2_route.get_schedule_import_job`, `module.lambda.aws_iam_policy.import_jobs`, `module.lambda.aws_iam_role_policy_attachment.import_jobs`, `module.lambda.aws_lambda_function.import_worker`, `module.lambda.aws_lambda_function_event_invoke_config.import_worker`, `module.storage.aws_s3_bucket_lifecycle_configuration.this`. Each reason is `delete_because_no_resource_config`. These are not approved deletions or evidence of obsolescence. |
| Two Lambda in-place updates | `module.lambda.aws_lambda_function.this` and `.indexer`: package hash/computed modification time. Archive hashes are deferred behind the local build helper. Applying would package restored V5 application source, rolling back the deployed async implementation; this is outside #284 and unsafe for this sandbox. |
| API Lambda environment change | `module.lambda.aws_lambda_function.this` would remove `IMPORT_WORKER_NAME`. This remains even with the approved Supabase override and would affect async dispatch. No environment change was executed. |
| Eighteen S3 in-place updates | Building index and two building JSON files change source/ETag/version; five SVGs and ten images change source/version. Earlier read-only comparisons found JSON values equal with line-ending differences and all fifteen SVG/image bodies identical. This check was not repeated as a new content snapshot; a future deployment must reverify the live bodies. Updates could create new versions. No object was uploaded. |
| Local replacement | `module.lambda.terraform_data.build` accounts for the one add and the seventh destroy. It is a local build helper, not an AWS resource. |
| Deferred data read | `module.lambda.data.archive_file.package` would be read after the helper. No archive from this plan was built or deployed. |

There are **zero AWS creations or replacements**, but six AWS deletions plus
the Lambda code/environment changes make the plan **unsafe to apply**. Existing
managed DynamoDB table/TTL had no proposed action. A zero-deletion claim from
the withdrawn feature reconciliation does not apply to this branch.

No AWS resource, application runtime, data, identity or state address was
changed. `-lock=false` avoided remote lock writes for this read-only audit;
it does not change the backend's configured locking behavior. Sensitive saved
plans and temporary overrides were deleted after review. Only sanitized evidence
is retained in the documentation. GitHub CD is unchanged and still deploys
only `main`; this feature branch was not deployed.

#### Remaining risks and acceptance criteria

| Acceptance area | Status |
|---|---|
| Infrastructure-only scope | Satisfied locally: exactly three audit/automation files differ from V5, with no backend/frontend/module feature changes. |
| Architecture, state isolation and ownership evidence | Documented in this audit and the six-resource investigation. Async feature ownership remains separate from V5's application baseline. |
| Local formatting, validation and CI checks | Pass, with the existing Terraform deprecation warnings. |
| Safe reconciliation of sandbox from this branch | **Not satisfied**: six AWS deletions, two code updates and an environment-variable removal are planned. Do not apply. |
| Existing resources and state preserved during the audit | Satisfied: no apply, destroy, import, state removal/migration, deployment or live mutation. |
| Frontend Terraform state ownership | Unverified, explicitly left as a blocker at the operator's request. |
| State bucket versioning | Previously confirmed not enabled; enabling it requires separate shared-infrastructure approval. No change made. |
| Account/region safeguards | Read-only target checks pass; persistent guards still cover only workspace/bucket/environment, not a configured account allowlist. |
| Bucket location | Previously denied check subsequently succeeded and matched backend configuration. No policy change was made by this agent. |
| Deployment inputs and reproducibility | Local Supabase inputs still differ from deployed settings; final Lambda ZIP hashes are deferred, and the earlier isolated build showed unpinned dependency drift. Neither is fixed by an audit-only branch. |

Issue #284's inspection and reporting work is delivered, but its safe-management
acceptance criteria are **not fully satisfied**. Resolving sandbox drift requires
an owner-approved infrastructure/application ownership and artifact-management
decision outside this audit's implementation scope. No feature integration,
ignore_changes workaround, resource removal or automatic deployment is proposed
as part of #284. No work on #281 was performed.

## 6. V5 CI validation (#281)

Work for [Issue #281](https://github.com/Gikeeeeeee/CS361_G06/issues/281)
was performed separately on `feature/v5/ci-validation`, created from
`feature/v5/terraform-state-audit` at `aec199c`. The #284 commits, documentation,
Terraform version constraint and CI improvements are inherited. This section
records local CI validation, not resolution of the infrastructure drift recorded
above. No application, Terraform resource or CD workflow was changed for #281.

### Implementation and reused work

Only `.github/workflows/ci.yml` and this documentation changed relative to the
audit branch. Reused from #284: PR targets `main`, `V4`, `V5`; Python 3.13 tests
excluding the `api` marker; both Terraform roots in a matrix; recursive formatting,
backend-disabled noninteractive initialization and validation with committed
provider locks.

Additional CI changes give each Terraform root a distinct check name, disable
matrix fail-fast so both roots report results, restrict the workflow token to
`contents: read`, and pin Terraform to the locally verified version 1.15.8.
No step uses `continue-on-error`. No AWS credentials action, secrets reference,
plan, apply, import, state operation or deployment command exists in CI.

The expected check names are `Python Tests`,
`Terraform Validate (terraform-backend)` and
`Terraform Validate (terraform-frontend)`. Failing commands fail their jobs;
requiring those jobs for merge depends on repository branch-protection settings.

### Local evidence

| Check | Result |
|---|---|
| Backend `python -m pytest -v -m "not api" -p no:cacheprovider` | **361 passed, 38 deselected** on Python 3.13, with AWS environment credentials removed and shared credential/config lookup disabled. The local cache-provider switch avoids an unrelated inaccessible pytest cache; CI retains its original pytest command. |
| Both roots: `terraform fmt -check -recursive` | Pass. |
| Both roots: `terraform init -backend=false -input=false -lockfile=readonly` | Pass using fresh isolated source/data directories without copied state, tfvars or `.terraform` caches. Public provider-registry downloads required network access outside the sandbox; AWS configuration and credentials remained disabled. |
| Both roots: `terraform validate -no-color` | Pass on Terraform 1.15.8. Backend retains 14 DynamoDB deprecation warnings; frontend has no validation warning. |
| Invalid Terraform negative control, each isolated root | A temporary output referring to an undeclared resource was rejected with exit 1 and `Reference to undeclared resource`. The temporary files were removed. No tracked Terraform file changed. |
| `actionlint` 1.7.12 against `ci.yml` | Pass for workflow syntax, expressions, matrix context and action inputs. Official release SHA256 verified. ShellCheck/Pyflakes integration disabled because those optional tools were not part of this local check. |
| YAML and configuration assertions | Pass: V5 PR target, both roots, read-only token, noninteractive backend-disabled init, no ignored failures, no secret references, pinned Terraform and correct ancestor branch. |
| `git diff --check` and scope checks | Pass; backend/frontend, Terraform files and CD workflow unchanged from the audit branch. |

No live remote backend was initialized. No AWS API, Terraform plan or
state-changing command was run for #281. The validation snapshots did not
create a backend metadata/state file. Committed provider locks remain unchanged.

### Acceptance status and remaining verification

V5 PR triggering and both-root execution are correctly configured and pass
local static checks. Backend tests and credential-free Terraform checks pass;
invalid Terraform fails validation. Existing V5 functionality and all production
resources/data remain unchanged. Local implementation is **ready for review**.

The issue additionally requires a workflow run URL. A published PR targeting
V5 must confirm actual GitHub-hosted Ubuntu execution, action/dependency
downloads, all three check results and attach its run URL. Local Windows checks
do not establish a GitHub-hosted run. A GitHub read of V5 branch protection
returned 403 (`Resource not accessible by integration`), so required-check merge
enforcement is unverified. An administrator should verify the actual check names
from that run are required; no branch-protection change was attempted.

These are remote acceptance-evidence gaps, not failures of the local tests.
Issue #281 should not be marked fully accepted until run evidence and merge-gate
configuration are verified. No commit, push, PR creation, merge, deployment or
work on another issue was performed.

References: [GitHub workflow syntax and PR branch filters](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
[matrix context availability](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts),
[Terraform backend-disabled initialization](https://developer.hashicorp.com/terraform/cli/commands/init),
[static Terraform validation](https://developer.hashicorp.com/terraform/cli/commands/validate).

### Frontend provider checksum follow-up (Draft PR #288)

Failure reference: [CI run 42498929018](https://github.com/Gikeeeeeee/CS361_G06/actions/runs/42498929018).
Its Python and backend Terraform jobs passed. Frontend Terraform 1.15.8 on
Linux AMD64 installed the signed AWS 6.63.0 package, warned `Provider lock file
not updated` under readonly initialization, then failed validation because the
unpacked provider did not match the recorded content hashes.

The frontend lock contained two `h1` content hashes and sixteen `zh` ZIP
hashes; the backend AWS entry contained one additional `h1`. Every existing
AWS ZIP hash in both locks was checked against the official release manifest,
including the Linux AMD64 ZIP hash: none mismatched. This was missing Linux
content-hash coverage, not evidence of an unsigned or corrupted release.
A fresh Linux AMD64 container using Terraform 1.15.8 reproduced the original
warning and validation error with the old frontend lock. The previous local
Windows validation did not exercise this Linux-specific failure.

The fix was generated directly from the official provider registry:

```powershell
terraform -chdir=terraform/terraform-frontend providers lock -platform=linux_amd64 -platform=windows_amd64
```

Terraform reported signed HashiCorp packages for both platforms, added Linux
coverage and confirmed Windows coverage was already recorded. Only one Linux
`h1` was added to `terraform/terraform-frontend/.terraform.lock.hcl`; both existing
`h1` values and all sixteen `zh` values were retained. No hashes were invented
or copied from the backend lock. AWS stays at 6.63.0 with constraint `~> 6.0`;
the unchanged backend also retains archive 2.8.0 with constraint `~> 2.4`.

Only the frontend lock file and this Issue #281 documentation are modified.
The workflow, provider constraints, resource definitions and application code
are unchanged. In particular, CI retains `-lockfile=readonly`, Terraform
1.15.8, backend-disabled initialization and all existing PR/matrix/permissions
controls. No AWS credentials, Terraform state operations, plan or deployment
are involved.

Post-fix local validation used fresh source/provider directories, with no reused
`.terraform` binaries or global provider caches and no AWS credentials:

| Platform / root | Formatting, readonly backend-disabled init, validate |
|---|---|
| Linux AMD64 / frontend (Terraform 1.15.8 container) | All pass; original checksum error and lock-update warning absent. |
| Linux AMD64 / backend (separate Terraform 1.15.8 container) | All pass; existing 14 DynamoDB deprecation warnings remain. |
| Windows AMD64 / frontend | All pass; existing Windows checksum coverage preserved. |
| Windows AMD64 / backend | All pass; existing deprecation warnings remain. |

All four snapshots retained byte-identical lock files under readonly init;
none created backend metadata or state. The original lock failed the clean
Linux reproduction as expected, before the one-hash fix. Backend tests still
pass: 361 passed, 38 live-API tests deselected. `actionlint` 1.7.12 and
`git diff --check` pass. No workflow, application or infrastructure behavior
change is needed.

After local validation, this fix is to be committed and pushed only to the
existing `feature/v5/ci-validation` branch, allowing Draft PR
[#288](https://github.com/Gikeeeeeee/CS361_G06/pull/288/checks) to rerun CI.
No new PR, merge, deployment or automatic issue closure is authorized. The
new GitHub Actions run must confirm all three jobs before the checksum-fix
acceptance criterion is considered verified remotely.

## 7. Post-deployment API smoke verification (#282)

Implemented locally on `feature/v5/post-deploy-smoke-tests`, branched from
`feature/v5/ci-validation` at `aef2058`. The #284 audit and #281 CI/checksum
work are preserved. This work changes automation only, with no application
service, API contract, Terraform resource, state or deployed data changes.

### Verified architecture and contracts

`scripts/smoke_test.py` uses only Python's standard library. It performs GET
requests against the existing public read endpoints; no Supabase token, IAM
signing, AWS SDK or additional AWS permission is required. Routes and response
fields were checked against `backend/handler.py`, the building/floor models and
services, `BuildingRepository.presigned_url`, existing contract tests and
`docs/contract/floor.json`. It does not reuse the live API suite, which also
contains writes and deployment-specific IDs.

| Check | Verified contract |
|---|---|
| `GET /api/v1/buildings` | HTTP 200, JSON object, nonempty `buildings` list with nonempty building `id` and `code`. Error envelopes fail even with HTTP 200. |
| `GET /api/v1/buildings/{code}` | `id` and `code` match discovery; `floors` is an array of unique floor IDs/numbers. Buildings without floors can be skipped during discovery. |
| `GET /api/v1/floors/{floorId}` | Floor `id` and integer `floor_number` match the chosen building's summary; `rooms` and `facilities` arrays and their required pin fields/types are checked. `floor_plan.type` must be `svg` and its URL nonempty. |
| SVG GET | Exact trusted asset origin/path, HTTP 200, `image/svg+xml`, valid XML with an SVG namespace/root, no DTD/entities, and content matching the checkout baseline after XML line-ending normalization. |

Default coverage is **one representative building/floor pair**, discovered by
building-code order, then the lowest available floor number. No deployment ID
is embedded in the script. Optional `--building-code` and `--floor-number`
selection must match discovery; a floor selection requires a building code.
This is a focused smoke check, not exhaustive campus or browser-rendering coverage.

The floor response does not contain a building ID or raw S3 key. Association
therefore follows the building summary's floor ID and number, then the matching
building-code/floor-number entry in checkout `building-data/building/*.json`.
Its `floor_plan_key` supplies the expected path and local SVG file; UUIDs in the
source metadata need not equal deployment UUIDs. This avoids guessing filenames
or trusting an arbitrary SVG URL merely because it returns 200.

The trusted checkout is the deployment baseline: its SVG SHA256 is compared
with the retrieved content after CRLF/CR-to-LF normalization. A mismatch fails
as wrong or potentially stale content; it does not prove how old the content
is or which historical version it came from. Missing/ambiguous metadata or a
missing baseline file fails as unverifiable. Even a matching digest does not
prove cache age, physical-map correctness or historical freshness. A reviewed
baseline must not be replaced with a failing remote response simply to pass.

### Original post-apply integration (historical #282 evidence)

The current authorized dry-run scope in section 12 has no apply/live smoke step.
The following records the earlier integration, not the current execution path.
The checker and its offline tests remain unchanged.


The existing CD trigger remains **push to main only**, with `TF_WORKSPACE=default`,
the existing AWS credential setup, concurrency and destructive-plan rejection
unchanged. All pre-existing steps through `Terraform Apply` are preserved.
Two steps are appended: setup Python 3.13, then smoke verification. GitHub's
normal success condition ensures neither runs after a failed apply.

The verification step obtains existing Terraform outputs, without adding any
new Terraform configuration or permission:

```bash
API_BASE_URL="$(terraform output -raw api_endpoint)"
ASSET_BASE_URL="$(terraform output -raw cdn_url)"
export API_BASE_URL ASSET_BASE_URL
python ../../scripts/smoke_test.py
```

These commands run from the existing backend Terraform working directory only
after a future approved deployment. The script resolves its baseline relative
to its own file, so working-directory differences do not change the data source.
`api_endpoint` is the API Gateway base without `/api/v1`; `cdn_url` is the
trusted CloudFront base. Existing repository behavior serves CDN asset URLs
when `ASSET_BASE_URL` is set and can generate signed S3 URLs otherwise. This
CD check expects the configured CDN origin; an unexpected fallback origin fails.

A smoke failure marks **deployment verification failed**, with no automatic
destroy, rollback, repeat apply or state manipulation. It does not undo the
already-completed deployment. CI's existing Python job also runs
`python -m pytest -v scripts/tests`, using dependencies already installed for
backend tests; the smoke script itself needs no dependency installation in CD.
Existing CI triggers, permissions and Terraform matrix are unchanged.

### Offline execution and CD result handling

The focused offline command is:

```text
python -m pytest -q scripts/tests/test_smoke_test.py -p no:cacheprovider
```

Live verification is reserved for a future approved post-apply main CD path,
not this dry run or a separate manual endpoint-selection procedure. The existing
checker and tests are unchanged. A trusted release baseline remains required;
do not replace it with downloaded content to make a failing check pass.

Exit 0 means the sampled API chain and SVG baseline passed. Exit 1 indicates
verification failure; exit 2 indicates invalid/missing configuration. Logs name
the failed operation/category without dumping URL values or server bodies:

| Failure category | Meaning |
|---|---|
| `API_UNAVAILABLE` | Non-200 API status, timeout, connection or transfer failure. |
| `API_CONTRACT` | Invalid JSON/content type, missing fields, error envelope or inconsistent building/floor/pin data. |
| `INCORRECT_REFERENCE` | Missing/invalid SVG reference, unexpected origin or wrong building/floor asset path. |
| `ASSET_INACCESSIBLE` | SVG retrieval failed or returned non-200. |
| `MALFORMED_ASSET` | Wrong MIME type, oversized asset, malformed/non-SVG XML, or DTD/entity declaration. |
| `ASSET_MISMATCH` | Structurally valid SVG differs from the trusted baseline; potentially stale or wrong, with historical age unknown. |
| `BASELINE_UNAVAILABLE` | Trusted metadata/content is missing, ambiguous or invalid; association/freshness cannot be established. |

Security: only GET requests; no Authorization headers or token inputs; no URL
or raw exception/body logging; signed URL queries are preserved for retrieval
but never printed. HTTPS origins/paths are validated and redirects are refused
instead of forwarding signed queries to another target. Responses are capped
at 8 MiB. The checker does not execute SVG scripts or fetch embedded subresources.

### Local validation and acceptance status

| Check | Result |
|---|---|
| Smoke implementation tests | **57 passed**. Fake HTTP opener and temporary asset metadata/SVG fixtures; external socket connections blocked in unit tests. |
| Failure scenarios | Non-200, invalid JSON/JSON MIME, missing fields, mismatched building/floor, bad/missing SVG URL, wrong origin/path, invalid XML/MIME/encoding, content mismatch, missing baseline, bad pins, duplicate floors, oversize responses, connection/timeout failures, redirect refusal and signed-query redaction. Success/failure/configuration exit codes and CD-style environment inputs covered. |
| Existing backend tests | **361 passed, 38 live-API tests deselected**, with AWS credentials/config lookup disabled. |
| Workflow validation | CI/CD YAML parsing and actionlint 1.7.12 pass. Optional ShellCheck/Pyflakes integration was disabled for the local actionlint invocation. |
| Safeguard assertions | Existing CD prefix through apply is identical; main trigger, default workspace, credentials, concurrency and deletion guard preserved. CI's Terraform job is identical; only the script-test step was added. |
| Scope and diff checks | `git diff --check` passes; no backend/frontend application or Terraform file changes. |

Local implementation criteria are satisfied: reusable script, verified contracts,
invalid-response failures, SVG baseline/reference checks, redacted logs, automated
post-apply wiring, safeguards and passing tests. New/modified files are
`scripts/smoke_test.py`, `scripts/tests/test_smoke_test.py`,
`.github/workflows/cd.yml`, `.github/workflows/ci.yml` and `DeployFlow.md`.

**Live post-deployment execution and a CD run URL remain unverified.** No live
API or AWS request, Terraform plan/apply/destroy/state operation, resource/data
mutation or Lambda update was executed for this task. The #284 sandbox plan
remains unsafe; do not deploy this branch to exercise the checker. A later
approved, independently safe deployment is required for end-to-end evidence.
Deployment data must have a corresponding trusted release baseline, and sampled
coverage cannot establish correctness of every floor or historical cache age.

Stopped after local implementation and validation: no commit, push, PR creation,
merge or deployment. Draft PR #288 is unchanged. No work on #283 was performed
in that #282 task.

## 8. Frontend build and deployment preparation (#283)

Work is on the existing `feature/v5/frontend-deploy-automation` branch fetched
from origin, based on the committed #282 smoke-test branch. The initial worktree
was clean. This section records local automation preparation only; it does not
establish live frontend ownership or authorize deployment. No application,
Terraform resource, backend CD or repository-secret changes are included.

### Architecture and ownership evidence

Inspected `frontend/package.json`, `package-lock.json`, `vite.config.ts`,
`index.html`, `.env.example`, runtime environment consumers, both workflows,
the frontend Terraform root/module/outputs and backend storage module.
The existing build is `tsc -b && vite build`, with `dist/`, root asset paths
and no source maps. `frontend/package-lock.json` is the dependency authority.

The **configured** frontend hosting architecture is a private, encrypted S3
bucket, public-access blocking, CloudFront OAC and a bucket policy scoped to the
distribution. Terraform manages each `dist/` file as an S3 object. CloudFront
uses Managed-CachingOptimized, redirects HTTP to HTTPS and serves `index.html`
for S3 403/404 responses to support SPA routing. HTML objects have `no-cache`;
other files use default cache behavior. Cache policy minimum TTL can still
affect HTML freshness. No frontend bucket versioning resource is declared.
These are configuration findings, **not verification of actual production
hosting, ownership, live cache settings or object versions**.

Frontend authoritative state remains unavailable/unverified, as established
by #284. The root has no remote backend declaration. Existing instructions
and the module require a manual build before Terraform can upload its files;
the backend CD workflow does not build/deploy the frontend. There is no verified
current manual operator process or authoritative frontend deployment history.
Do not initialize a new state, run apply, or add direct S3 uploads: uploads could
conflict with the Terraform-managed object ownership model.

### Automation and required configuration

`scripts/frontend_release.py build --output <new-directory>` validates explicit
process environment inputs, copies frontend sources into an isolated temporary
directory excluding `.env*`, local overrides, node_modules and generated output,
runs `npm ci --include=dev --no-audit --no-fund`, then the existing build script.
No application build script, component or service is changed. Unknown inherited
`VITE_*` inputs are discarded. Output must not already exist; existing releases
are not overwritten. Source files and local environment files are preserved.

Required public browser inputs are `VITE_API_BASE_URL`, `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. Base URLs must be HTTPS origins without credentials,
query strings or fragments; API version defaults to the application's existing
`/api/v1` contract and alternate versions are rejected. The key must be a
publishable key or legacy JWT with an anon role; service keys are rejected.
This is syntactic validation, not verification of key authenticity or endpoint
ownership. Never put a private secret into any `VITE_*` value: Vite embeds these
in browser assets. Configuration values are not printed or stored in metadata;
their combined SHA-256 fingerprint is recorded. Prepared browser bundles still
contain the public configuration, as expected.

The manifest is outside `dist/` and records revision, frontend dirty flag, Node
and npm versions, lockfile/config hashes and SHA-256/size of every generated
file. Node 22.17.0 is selected in workflows (local minimum 22.12); npm is bundled
with that Node release. Locked installation provides dependency reproducibility;
cross-platform byte-identical builds and signed release provenance are not
claimed. Local dirty builds are labelled, not silently represented as committed.

CI adds an independent frontend job on the existing PR triggers. It uses
reserved `.invalid` endpoints and a public test-key fixture, never repository
production configuration or AWS credentials. Its artifact is named
`frontend-verification-<sha>` and **must not be deployed**. The existing Python
job also runs preparation tests through its existing `scripts/tests` command.
Existing Terraform CI and backend CD behavior remain unchanged.

CI is the single automated frontend build/verification path. The former
manual `frontend-build.yml` duplicated that work and is removed. Reserved CI
configuration is intentionally not deployable; no new repository Variables or
Secrets are required for build verification. Real frontend deployment and its
public build configuration remain pending verification of existing hosting and
state ownership. No frontend write or invalidation step is enabled in main CD.

### Integrity, SVG delivery and preparation guards

`python scripts/frontend_release.py verify --artifact <prepared-directory>`
checks the entire file inventory against its trusted manifest, including every
static SVG, HTML and hashed JS/CSS. Missing, extra or altered bodies fail; an
HTML 200 fallback would not prove that a requested asset is correct. Local
HTML script/link paths must resolve to manifest files without traversal or
query strings. Symlinks, hidden files and backend-owned asset prefixes are
rejected. The existing source HTML references external Leaflet JS/CSS; these
references are recorded and checked for preservation, **not downloaded or
hash-certified**. Their upstream availability/content remains a dependency.
The initial strict check rejected these references after a successful build;
the checker was corrected and tested without editing the application HTML.

The manifest must itself come from a trusted build/artifact channel; replacing
both manifest and files defeats a plain checksum comparison. This tool performs
offline integrity checks, not a live CDN freshness check or cryptographic
attestation. An approved future deployment must compare delivered bodies against
the approved manifest rather than HTTP status or multipart S3 ETags alone.

Floor-plan SVGs are **not frontend build artifacts**. Backend Terraform owns
the separate versioned asset bucket, `floor-plan/*` objects and CDN. Backend
services return their asset URLs (CDN or signed S3 URLs). The configured
floor-plan cache policy has a 300-second maximum TTL and ignores query strings;
changing a query parameter alone is not evidence of cache bypass. S3 versions
and CloudFront cache entries are distinct. Nothing here uploads SVGs, changes
versions or invalidates caches. The existing #282 `smoke_test.py` compares a
discovered API floor SVG with trusted building metadata and local SVG content;
it remains the separate read-only verifier for that path. Neither verifier
establishes historical freshness without a corresponding release baseline.

`verify_target()` is an injectable preparation guard, deliberately not connected
to AWS credentials, a CLI command or a deployment job. Mocked read-only calls
cover caller account, expected bucket account/canonical owner/region and
distribution ARN/account/ID, single default S3 origin, OAC, absence of an origin
prefix and unexpected cache behaviors. Permission errors or mismatches stop
verification. Even a match returns `state_ownership_verified: false` and
`deployment_enabled: false`; identity matching does not prove Terraform ownership.
Real identifiers must eventually come from reviewed authoritative state and
operator configuration, never guessed names. No live identity check was run.

### Validation and remaining acceptance gates

Local checks use reserved test configuration only. Commands:

```text
python scripts/frontend_release.py build --output scratch/issue283-build
python scripts/frontend_release.py verify --artifact scratch/issue283-build
python -m pytest -q scripts/tests -p no:cacheprovider
actionlint -shellcheck= -pyflakes= .github/workflows/ci.yml .github/workflows/cd.yml
git diff --check
```

| Local check | Result |
|---|---|
| Isolated `npm ci` using existing frontend lock | Pass: 146 packages installed; Node 22.17.0 / npm 11.4.2; lock unchanged. |
| Existing `npm run build` | Pass: TypeScript and Vite production build; existing large-chunk advisory remains. Reserved test configuration only. |
| Prepared artifact re-verification | Pass: generated files, hashes and entry point references match. |
| `python -m pytest -q scripts/tests -p no:cacheprovider` | **90 passed**: 33 preparation tests plus 57 existing smoke tests. Includes missing/invalid configuration, public-key restriction, wrong/missing/extra/stale JS/SVG/HTML, unsafe references, isolated locked build, no output overwrite, mocked identity mismatches and denied permission. |
| Workflow YAML and actionlint 1.7.12 | Pass for CI, backend CD and frontend build preparation. Optional external ShellCheck/Pyflakes disabled. Structured YAML comparison confirms all pre-existing CI jobs/triggers/permissions are unchanged. |
| Scope and whitespace | `git diff --check` passes; backend, frontend, Terraform and backend CD match `feature/v5/post-deploy-smoke-tests`. |

The original #283 work added CI build verification, build/integrity tooling,
offline tests and a manual build workflow. The latter is now removed; build
and integrity tooling/tests remain unchanged. Historical validation below
does not establish a frontend deployment. Build output and
local check helpers remain ignored under `scratch/`. No live API/AWS calls,
Terraform initialization/plan/apply/destroy/state changes, S3 writes, cache
invalidations, deployment, commit, push, PR modification or merge were performed.

Before any deployment: locate authoritative frontend state and owner; verify
live production hosting/resource identity and permissions; approve non-production
configuration and target; resolve whether Terraform remains the sole object
writer; review cache/rollback/versioning behavior; explicitly approve deployment.
The #284 unsafe sandbox plan remains unresolved and must not be used to exercise
this automation. Actual non-production deployment, delivered-content checks and
GitHub-run evidence remain **unverified**. Local preparation can be reviewed;
full #283 deployment acceptance is blocked. No work on #285 was performed.

| #283 acceptance item | Status |
|---|---|
| Build process documented; locked build and traceable artifacts implemented | Pass locally. |
| Safe deployment process prepared | Preparation only; all deployment operations absent/disabled. |
| Identity and ownership safeguards | Mocked identity checks pass and cannot enable deployment; authoritative state/live ownership unverified. |
| Frontend SVG/asset integrity and floor-plan distinction | Pass locally; trusted manifest required; external Leaflet bodies and live CDN content not verified. |
| No environment-specific hardcoding, feature changes or AWS/state mutations | Pass; reserved fixtures only in tests/PR verification. |
| Local validation | Pass; actual GitHub workflow execution remains unverified. |
| Actual non-production deployment | **Blocked/unverified** until ownership, configuration and explicit deployment approval are established. |

References: [npm ci lockfile behavior](https://docs.npmjs.com/cli/commands/npm-ci/)
and [Vite environment loading and browser exposure](https://vite.dev/guide/env-and-mode.html)
support the isolated-install and public-configuration approach. These references
do not establish ownership or actual settings of the deployed frontend.

## 9. Sandbox reproducibility and recovery preparation (#285)

This work uses the existing `feature/v5/sandbox-reproducibility` branch based on
the committed #283 branch. The initial worktree was clean. This is an offline
validation and recovery design, **not evidence that sandbox can be recreated**.
No AWS/state access or refreshed plan was requested or executed for #285.

### Relevant baseline and unresolved drift

The focused review covered both Terraform roots, backend configuration and
deployment identity guard, provider locks, workflows, #284 findings, and existing
smoke/artifact validation scripts. Application features were not audited again
or changed. Backend state ownership remains the S3 backend declared in
`backend.tf`: `default` uses its base key; `sandbox` uses
`<workspace_key_prefix>/sandbox/<key>` (S3 default prefix `env:`). Native S3
lockfiles are configured. Existing guard checks workspace/bucket/environment,
but does not independently enforce the AWS account or provider region. The new
offline checks supplement evidence review; they do not change Terraform guards.

CI selects Terraform **1.15.8**; backend minimum is **1.10.0**, frontend minimum
**1.5.0**. Both roots lock AWS **6.63.0**; backend also locks archive **2.8.0**.
Readonly lockfile initialization must preserve the committed platform checksums.
Backend CD still does not select an exact Terraform version; no CD edit was
made here. Reproduction requires recording its actual tool version rather than
assuming it equals the local/CI tool version.

All six #284 async-import resources remain unresolved sandbox deletion
candidates. They exist in the historical state/AWS evidence and are not
established as obsolete. The current V5 baseline must not be applied to remove
them. Their exact addresses and dependencies remain documented in section 5.
The final #284 audit-only plan also proposed a local build-helper replacement,
API/indexer code updates, removal of `IMPORT_WORKER_NAME`, and S3 object updates.
Those are historical findings, not a freshly refreshed #285 plan. Local
Supabase inputs previously differed from deployed values. A zero-delete plan
would still require reviewing Lambda code/environment and every in-place change.

Other recovery dependencies remain: authoritative frontend state/ownership is
unverified; state-bucket versioning was not enabled in the audit snapshot;
state recovery cannot assume historical versions exist. The previously denied
bucket-location check was resolved in the final #284 scope-correction evidence,
not freshly repeated here. Lambda packaging requires Docker/Linux Python 3.12,
and dependencies are not all pinned. Artifact determinism, credentials/config
provenance, application/data compatibility and backup availability need separate
review. Do not integrate async-import code as a recovery shortcut.

### Repeatable offline gate

`scripts/sandbox_validation.py` has two commands and no live collection or
deployment mode. `local` runs only `terraform fmt -check -recursive` and
`terraform validate -json`, using an **already initialized** provider/module
cache. It clears inherited Terraform options and AWS environment inputs,
disables metadata/Checkpoint access and points credential/config lookups at
unused cache paths. Terraform diagnostics are reduced to pass/fail and warning
counts. A missing cache/provider fails; the script never falls back to init or
remote access. Validation does not establish runtime input correctness.

```text
python scripts/sandbox_validation.py local --root terraform/terraform-backend --data-dir <backend-offline-cache>
python scripts/sandbox_validation.py local --root terraform/terraform-frontend --data-dir <frontend-offline-cache>
python scripts/sandbox_validation.py inspect --expected <approved-config.json> --observed <private-observations.json> --plan <private-plan.json>
```

`inspect` reads existing `terraform show -json` plan output and separately
reviewed expected/observed JSON. **It does not run Terraform plan or AWS.** It
checks sandbox selection, caller account, state-scoped AWS ARN accounts/regions,
the root AWS provider's `var.aws_region` reference, plan variables, backend
bucket/key/region/prefix/locking, effective workspace key and tool versions.
AWS-managed global IAM policy references are distinguished from customer-owned
resources. Multiple/aliased AWS provider configurations are rejected for review;
the current repository uses one root provider. Empty prior state is rejected:
this gate is for the existing sandbox, not authorization to create a replacement.

Prepare private input files from authoritative sources **only after separate
authorization for their live collection**. Do not copy secrets or real IDs into
this repository. Required schemas:

| Input | Required fields and source |
|---|---|
| Expected | `workspace` must be `sandbox`; `account_id`, `region`, `terraform_version` from operator-approved environment/tool configuration. |
| Expected `backend` | `type` = `s3`, `bucket`, `key`, `region`, `workspace_key_prefix`, `use_lockfile` = true. Review against committed `backend.tf` and any approved overrides; normalize an omitted S3 workspace prefix to Terraform's documented `env:` default. |
| Expected `variables` | Map of approved nonsecret string inputs; requires `aws_region`, `bucket_name`, `environment`. Include reviewed resource naming inputs such as project/table/collection/index where applicable. Never use current defaults or local tfvars as proof of deployed ownership. |
| Observed | `workspace` from process-effective `terraform workspace show`, `caller_account_id` from STS, `terraform_version` from the CLI, `validation_passed` from successful validation of that checkout. |
| Observed `backend` | Same normalized fields, from resolved cached backend metadata in the authorized working directory; compare to independently reviewed expected configuration. Do not expose cached credentials. |
| Observed | `effective_state_key` = `<prefix>/<workspace>/<key>`; confirm that exact remote object exists/owns sandbox in the approved collection step. `plan_sha256` = SHA-256 of the exact JSON file bytes. |
| Plan | Unmodified private `terraform show -json` output, JSON format major 1, matching Terraform version, complete and non-errored, boolean `applyable`, prior state, configuration, variables and explicit `resource_changes` array. |

Captured JSON is evidence supplied by an operator, not an attestation. The gate
cannot detect fabricated observations or prove the snapshot is still current.
The JSON hash binds an observed record to the inspected bytes, not to a trusted
deployment. Retain provenance/time/revision with the private collection record.
Backend state serial/lineage and lock/provider/config hashes belong there too.

Exit **0** means offline checks passed with no changes; **1** means changes need
review; **2** means missing, malformed, incompatible or mismatched evidence.
Every create/update/delete/replacement/read/import/move/forget, nonempty drift
or changed output blocks the offline gate. No action allowlist, `--force` or
auto-approval exists. Local `terraform_data` replacements are reported rather
than suppressed. Lambda code/runtime/hash and environment changes, S3 object
changes and the six known async addresses are flagged. Deferred/incomplete
plans, unknown actions/checks and inconsistent no-op entries fail closed.
Provider action invocations (including deferred invocations) are rejected too;
an applyable plan without explained changes cannot be accepted as a no-op.
Thus a legitimate non-destructive update is visible but **not authorized**.

The summary contains action counts, fixed risk flags, hashed resource addresses
and a plan hash. Arbitrary addresses can contain private `for_each` keys, so raw
addresses, account/resource identifiers, plan values, outputs, exception text
and CLI inputs are never echoed. Detailed per-attribute review still uses the
private plan. All summaries explicitly set `deployment_authorized: false` and
`live_identity_verified: false`, including no-op results. Do not publish raw
plan JSON or saved plans: sensitive marking does not redact their contents.

### Optional safety preparation and release evidence

The sandbox gate stays offline because its approved expected/observed evidence
is not supplied by current main CD. It is not automatically fed guessed AWS
metadata, not an approval override and not another deployment entry point.
Preserve revision/tool/provider/config hashes, timestamps and private evidence
provenance when an owner separately authorizes read-only collection. Never
create replacement state, run targeted changes or silently migrate a backend.

All actual writes and post-apply verification belong to main CD. Its current
default workspace does not support sandbox deployment; neither sandbox support
nor a manual apply path is introduced here. Resolving drift, choosing a valid
application baseline and any future existing-sandbox support require a separate
reviewed change to the same CD, not a new pipeline. After an approved deployment,
record that CD's run URL/summary, exact artifact, outcome and post-apply results.
Any repeat-plan/recovery evidence must be separately authorized and cannot
override the existing-resource or ownership boundary. No reproducibility claim
is made without actual deployment evidence.

### Operational recovery (manual approval points)

| Failure | Safe response and approval boundary |
|---|---|
| Failed plan | Stop; inspect private diagnostics for inputs/provider/backend/IAM errors. Correct only reviewed configuration and rerun the full read-only plan after access authorization. Do not apply a partial/errored plan or treat exit 2 as failure. |
| Failed apply | Stop further deployments; preserve logs and available state/backend evidence. Determine which resources/data changed with authorized read-only inspection. Do not rerun blindly, restore old state, force-unlock or destroy. A recovery plan, state/backup owner and explicit approval are required before writes. |
| Wrong workspace/environment | Stop immediately. Preserve evidence, clear accidental process overrides and confirm expected caller/backend/key before a new read-only session. Never create a workspace or migrate/copy state to make a mismatch disappear. |
| Lambda failure | Compare approved artifact/hash, handler/runtime, layers, role and environment against actual deployment. A previous ZIP may be incompatible with current routes/data. Owner approval and a reviewed full plan are required for any redeploy/rollback; never deploy V5 code to the async worker as a repair. |
| API/SVG smoke failure | Stop promotion; distinguish API contract, access, wrong key/body and cache problems using trusted release metadata and hashes. HTTP 200 or a query change is insufficient. Read-only diagnostics need authorization; object writes or invalidations require separate approval. No automatic rollback/reapply. |
| Unexpected drift | Preserve private plan/state snapshot and sanitized summary. Establish owner/operator intent and dependencies, including six async resources. No imports, state removal/migration, targeting or feature rewrite to silence it. Resolve and explicitly approve a new plan. |
| Frontend artifact mismatch | Quarantine the artifact; verify trusted manifest, revision, public build configuration and lock/tool versions. Rebuild into a new local directory if needed. External Leaflet bodies are not certified by the manifest. Deployment stays disabled until frontend state/ownership and a safe release process are verified. |

Backups are dependencies to verify, not guarantees: state-bucket versioning,
application table backups/PITR, retained S3 versions and exact prior Lambda
packages were not reverified here. State restoration cannot restore application
data by itself. Never assume rollback reverses partial imports or expired files.

### Local evidence and acceptance status

Executed on Terraform 1.15.8 using the prior #281 caches at
`scratch/issue281-ci-validation/data-terraform-backend` and
`data-terraform-frontend`. No backend initialization or provider download was
performed. Both **current** roots passed fmt and validate through the new local
command: backend **14 existing deprecation warnings**, frontend **0 warnings**.
This is cache-backed local validation, not a fresh clean-provider installation.

| Local check | Final result |
|---|---|
| `python -m pytest -q scripts/tests -p no:cacheprovider` | **151 passed**: 61 new sandbox-gate cases plus 90 existing smoke/frontend-preparation cases. |
| Backend `local` command using the cache above | fmt/validate pass; 14 existing DynamoDB deprecation warnings. |
| Frontend `local` command using the cache above | fmt/validate pass; zero warnings. |
| actionlint 1.7.12 on all three existing workflows | Pass; optional external ShellCheck/Pyflakes disabled. No workflow changed. |
| `git diff --check` and scope comparison against `feature/v5/frontend-deploy-automation` | Pass; application, Terraform, workflows and prior validation scripts unchanged. |

Tests cover correct/incorrect workspace, missing configuration/files, account/
region/backend/key/locking mismatches, empty/no-op plans, creates/updates/deletes,
replacement in either order, six known deletion candidates, local helper
replacement, import/move/forget, drift/outputs, deferred actions/unknown checks,
Lambda code/environment flags, invalid/duplicate-key/nonfinite JSON, plan-hash
binding, secret/address redaction, exit codes 0/1/2 and only fmt/validate local
execution. All AWS identities in fixtures are synthetic. Tests do not establish
live permissions, current remote state or deployment convergence.

Existing CI already runs `python -m pytest -v scripts/tests`, so it automatically
includes the new tests without workflow changes. New files are
`scripts/sandbox_validation.py` and `scripts/tests/test_sandbox_validation.py`;
only this existing report is otherwise modified. Existing application,
Terraform resources/configuration, workflows and smoke/build scripts remain
unchanged from the #283 branch. No live plan, AWS/API call, state operation,
apply/destroy, deployment, commit, push, PR change or issue comment occurred.

Local preparation acceptance covers the repeatable validation gate, workspace/
environment evidence checks, destructive/ambiguous action rejection, tests,
recovery/evidence procedures and visible drift blockers. **Closing #285 remains
blocked** on verified live ownership/configuration, resolution of #284's unsafe
plan, explicit deployment approval, an actual sandbox apply, post-deployment
smoke results and a reviewed repeat plan. Reproducibility is not proven. No work
on #286 was performed.

Plan field semantics and private-plan handling follow HashiCorp's
[JSON output specification](https://developer.hashicorp.com/terraform/internals/json-format)
and [plan command reference](https://developer.hashicorp.com/terraform/cli/commands/plan).

## 10. Deployment security, credentials and monitoring audit (#286)

This is a repository/configuration review on the existing
`feature/v5/security-monitoring-audit` branch, based on the committed #285 work.
The initial worktree was clean. Only this report is modified. No credentials,
raw state, AWS policies/settings, monitoring configuration, application or
workflow behavior were changed. No AWS call, state access, subscription,
notification, credential rotation, repository-setting change or deployment was
performed. Historical #284 AWS observations are explicitly separated from
current configuration evidence; they were not refreshed here.

Reviewed the three workflow files, both Terraform roots and locks, backend
IAM/Lambda, storage, DynamoDB, OpenSearch and API Gateway modules, monitoring in
backend `main.tf`, variable sensitivity and outputs, and #284/#285 evidence.
The scope excludes application feature review and secret/state contents.

### Evidence classification and prioritized findings

**Verified** means the stated source/metadata fact was inspected; it does not
mean the declaration exists or is effective in AWS. **Unverified** identifies
missing live evidence. **Remediation recommended** records a proposed change;
**Requires approval** means it is not authorized by this audit. No confirmed
credential disclosure or exploitable AWS permission is asserted without evidence.

| ID / severity | Evidence and finding | Recommendation / approval boundary |
|---|---|---|
| SEC-01 / High | **Verified (Git metadata):** `terraform/terraform-backend/state-backup-20261002-192144.json` is tracked in HEAD, 493,650 bytes, first added in available history by `9423cc0` on 2026-10-02. **Unverified:** contents, whether it actually contains state/secrets and exposure history. The file was not opened. | **Remediation recommended:** owner-controlled confidential triage and repository exposure assessment. **Requires approval:** any content inspection, removal, history cleanup or credential response. Removing the current file alone cannot erase prior Git copies; do not rewrite history or rotate credentials automatically. |
| SEC-02 / High | **Verified (CD source):** AWS key/secret/session-token inputs come from GitHub Secrets, with no `role-to-assume`. **Unverified:** whether credentials are long-lived IAM keys or temporary credentials, expiry, rotation, owner and effective IAM/SCP/session permissions. Secret names alone cannot establish these facts. | Inventory credential metadata and access scope with separate authorization. Propose OIDC and short-lived environment-specific roles; do not claim the current principal is administrator or rotate it without owner approval. |
| SEC-03 / High | **Verified (workflow):** main pushes can reach apply without a declared GitHub job environment/manual approval gate. CD has no explicit `permissions` map; actual token permissions and branch/ruleset protections are **Unverified**. Delete guard does not review in-place IAM/environment/code changes and exempts `terraform_data`. | Explicit read-only GitHub token scope and protected deployment environment/branch review are recommended. Retain full action review and existing main/default boundary. Workflow/repository protection changes **Require approval**; no bypass or behavior change here. |
| SEC-04 / High | **Verified (historical #284 evidence):** state-bucket versioning was not enabled; frontend authoritative state ownership was unavailable. **Unverified:** current policies, versions, readers/writers and recovery readiness. The shared state bucket is not managed in these roots. | Authoritative bucket/state owner must review least privilege, backups and versioning separately. Enabling versioning protects future versions, not previously overwritten state. Shared-infrastructure changes **Require approval**. |
| SEC-05 / High | **Verified (source):** public OpenSearch network access is configured for collection/dashboard. API and indexer share index permissions including Create/Delete/UpdateIndex, Read/WriteDocument; a fixed deployer-user path is an additional principal. **Unverified:** effective live network/data/IAM access. Public network reachability is not proof of anonymous data access. | Review API read versus indexer write/admin needs and deployer access. Stage role/principal/network changes with compatibility evidence; narrowing access can break queries/indexing or deployment and **Requires approval**. |
| SEC-06 / High | **Verified (source):** three alarms route to one SNS topic; no subscription is declared. **Unverified:** live topic/policy/subscriptions, confirmation, recipient ownership and end-to-end delivery. | Assign an alert owner and obtain authorized metadata-only verification. A confirmed receiver and separately approved delivery exercise are needed before declaring operational alerting. No subscription or test message was created. |
| SEC-07 / Medium | **Verified (source):** API role reads every object in its asset bucket and can scan/read/write/delete its configured DynamoDB table and indexes. Both Lambda roles attach the basic-execution managed policy. **Unverified:** effective role policies and whether all grants are needed. | Map grants to actual runtime operations; assess prefix/action scoping and function-log permissions. Do not remove CRUD grants merely because this audit does not inspect business logic. Runtime IAM changes **Require approval**. |
| SEC-08 / Medium | **Verified (source):** credentials and tfvars are available to later CD tools; plaintext tfvars/plan are created on the runner, with no explicit cleanup step. CD references mutable action tags and an unpinned Terraform CLI; backend Python dependencies are not fully pinned. Actual logs/artifact retention are **Unverified**. | Restrict privileged step exposure, pin reviewed action/tool/dependency versions, review cleanup and prevent private plan/tfvars artifact uploads. Do not change packaging or deployment during this audit. |
| SEC-09 / Medium | **Verified (source):** API access logs have configured retention; explicit Lambda log-group retention, delivery-failure alarms, continuous endpoint/SVG checks and deployed import-worker alarms are not declared here. SNS customer-managed encryption is not declared. **Unverified:** live logging, encryption and out-of-band monitoring. | Review retention/privacy, notification failures and health coverage with the owner. Adding alarms, canaries, keys or subscriptions **Requires approval** and a cost/permission review. |

SEC-01 is a potential exposure, not a claim that any secret has been found.
No raw state backup or secret value was retrieved, printed, exported or stored
for this audit. The six async-import deletion candidates, Lambda rollback and
environment changes remain unresolved #284 deployment blockers; this security
review does not resolve or authorize them.

### Credentials, PR isolation and log exposure

CI and frontend preparation explicitly use `contents: read`. PR CI has no AWS
authentication action or Secret references; it excludes live API tests and
initializes both Terraform roots with `-backend=false -input=false
-lockfile=readonly`. Frontend PR builds use reserved test configuration. Manual
frontend preparation consumes public `VITE_*` Variables, validates the key type
and keeps deployment disabled. Browser configuration is intentionally present
in its bundle; a Supabase service key must never be supplied. Neither workflow
grants OIDC token issuance in its current source.

CD is restricted to `push` on `main`, sets `TF_WORKSPACE=default` and keeps
concurrency cancellation disabled. It authenticates through three Secret
references using `configure-aws-credentials@v4`. The session-token reference is
configured, but existence, validity and consistency with the key pair are not
verified. Temporary credentials need a matching valid session token and may
expire during a job; no expiry/refresh evidence was collected. Secret placement
at repository versus organization scope, access policies and inventory metadata
were not queried. GitHub Secret references are not proof of least privilege.

The tfvars-writing command redirects the variable to a file rather than
printing its contents. The JSON-plan command pipes to jq and prints selected
actions/addresses, not raw JSON. No deliberate raw-state dump or direct secret
stdout command was found in the reviewed workflows. This is source evidence,
not a guarantee about provider diagnostics or runtime logs. GitHub masking of
a multiline tfvars Secret must not be assumed to protect every derived value.
Resource addresses/outputs can expose infrastructure metadata; arbitrary
`for_each` keys can include user data. Restrict log access and use sanitized
summaries. Do not enable shell tracing or Terraform debug logs in privileged
jobs without a reviewed redaction plan.

A bounded offline pattern check of **29 tracked workflow/Terraform source
files** found no AWS access-key candidates, private-key headers or JWT-like
literals. Results contained categories/path counts only, never matched values.
It excluded state/backups, private tfvars, `.env`, credential files and history
blob contents. Available-ref filename history showed the tracked backup above,
but no `.env`, private tfvars, conventional tfstate, credential or PEM paths
matching the reviewed patterns. This is **not a complete historical secret scan
or evidence that the repository is secret-free**. Renamed/encoded secrets and
other file types are outside this check. Git ignores do not untrack files, and
the conventional tfstate patterns do not cover this backup's JSON filename.
No secret-scanner service, upload or GitHub secret inventory was invoked.

### IAM scope and state security assessment

The Terraform-managed Lambda roles trust the Lambda service, not GitHub. The
deployment principal is a separate identity and its effective IAM policies are
not defined here. It is therefore **Unverified** whether its deployment grants
are broader than required. Review role/user attachments, inline/session
policies, permission boundaries and SCPs using authorized metadata before making
that determination. The named deployer-user principal in OpenSearch is a
configuration dependency, not proof of the current credential owner.

Runtime source scopes S3 reads/listing to the asset bucket, DynamoDB CRUD/scans
to one table and its indexes, indexer stream reads to the configured stream,
and `aoss:APIAccessAll` to the collection. The collection/index data policy is a
second authorization layer and currently grants the same data operations to API,
indexer and deployer principals. Separate query, indexing and schema-management
responsibilities before proposing narrower grants. The attached
[AWSLambdaBasicExecutionRole](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/AWSLambdaBasicExecutionRole.html)
allows log creation/writes with wildcard resource scope; precreated function
log groups and scoped custom grants merit review, not immediate replacement.

| State control | Evidence status / limitation |
|---|---|
| Remote backend and locking | **Verified (source):** S3 backend and `use_lockfile=true`; backend requires Terraform 1.10+. **Unverified:** successful current lock acquisition and IAM enforcement. No lock was taken here. |
| Workspace isolation | **Verified (source):** default key versus `env:/sandbox/<key>` and bucket/environment guard. **Unverified:** key-specific IAM isolation and caller account/region enforcement in the actual deployment. Workspaces are not separate security principals/accounts. |
| Encryption and public blocking | **Verified (historical #284 evidence):** AES256 default encryption and all four public-block flags. **Unverified now:** effective bucket policy/ACL/TLS-only enforcement, access auditing, key controls and current settings. `backend.tf` itself does not declare the bucket or explicit backend `encrypt`; that alone does not establish unencrypted state. |
| Versioning/backups | **Verified (historical):** versioning not enabled. **Unverified now:** approved backup copies/restoration evidence. Local Git backups are not an acceptable substitute for controlled encrypted recovery storage. |
| Sensitive fields | **Verified (source):** Supabase JWT secret/anon-key variables are sensitive in root and Lambda module, and passed into Lambda environment attributes. State/plan representations can retain such values; no values were inspected. `sensitive` is display protection, not at-rest omission. |
| Authoritative access and frontend | **Unverified:** state bucket owner policy, reader/writer list, recovery-role permissions and frontend authoritative state. No replacement backend, migration or empty state was initialized. |

Use separate audit/deploy/recovery roles. An audit role should not have state
write or lock-delete access. An approved deploy role needs bucket listing
restricted to its state prefix, Get/Put for its exact state object and
Get/Put/Delete for its matching `.tflock`; deleting the state object is not a
normal backend requirement. Default CD and sandbox should not share unrestricted
state-prefix access. Recovery/version reads and destructive recovery rights
belong to a separately controlled role. If SSE-KMS is approved, review both IAM
and KMS key permissions and failure recovery before changing encryption.
See [S3 backend permissions and recovery guidance](https://developer.hashicorp.com/terraform/language/backend/s3)
and [Terraform sensitive-data semantics](https://developer.hashicorp.com/terraform/language/manage-sensitive-data).
Ephemeral flags cannot simply be added to values persisted in ordinary Lambda
environment attributes; secret storage/retrieval redesign requires its own plan.

### OIDC recommendation and scoped implementation proposal

OIDC is feasible with the existing AWS credential action, but **not ready to
activate without approved identity/trust/role configuration**. There is no OIDC
provider resource in these roots; whether one already exists in the AWS account
is **Unverified**. Do not create a duplicate provider or manage an existing one
from an unowned state.

Proposed trust requirements: the approved account's IAM provider for
`https://token.actions.githubusercontent.com`, `sts:AssumeRoleWithWebIdentity`,
exact audience `sts.amazonaws.com` for the existing AWS partition and exact
repository/subject conditions. Do not use a wildcard repository/branch subject.
Verify this repository's actual subject format first: GitHub documents both
legacy name-based subjects and immutable owner/repository-ID subjects. Do not
retrieve or log a full token to establish its format. If legacy format is
confirmed, the branch-scoped subject would identify
`Gikeeeeeee/CS361_G06` and `refs/heads/main`. No feature/PR/fork subject should
match the deploy trust.

The recommended protected-environment option uses the exact approved environment
subject instead. That default subject does **not also encode the branch**;
restrict deployments to main through environment deployment-branch rules,
required reviewers and reviewed bypass/self-review settings. Those settings
and availability are currently **Unverified**. Scope `id-token: write` to the
approved deploy job, retain `contents: read`, and grant neither AWS credentials
nor token issuance to PR validation. These conditions follow
[GitHub's AWS OIDC guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws).

The deployment role must be separate from runtime roles, with approved
account/region/resource and state-prefix scope. Build its policy from this
stack's required operations and reviewed usage evidence, not AdministratorAccess.
Restrict `iam:PassRole` to the exact Lambda execution roles and Lambda service;
review IAM role/policy management against privilege escalation and permission
boundaries. Some APIs require wildcard resources: document each necessary
exception with supported conditions. Do not invent a complete least-privilege
policy without actual permission evidence. The OpenSearch policy's fixed
deployer-user principal must be evaluated for the new role, including any
data-plane deployment operation. Preserve operational access until verified.

Scoped migration sequence, **all implementation Requires approval**:

1. Approve the target account/environment, authoritative IAM/provider ownership,
   trusted subject format, branch/environment protections, policy scope and
   short session duration. Obtain metadata-only access evidence; do not inspect
   or export Secret values. Keep sandbox and main/default scopes separate.
2. Prepare a separately reviewed IAM/provider/role change in its authoritative
   infrastructure location, with exact audience/subject restrictions, scoped
   permissions, audit/session attribution and a reviewed break-glass procedure.
   Check OpenSearch principal compatibility and state-lock access explicitly.
3. Prepare a reviewed workflow/settings change using the approved role reference,
   job-scoped token permission, protected environment and permitted-account
   verification. Retain triggers, workspace, concurrency, destructive guard and
   post-apply smoke behavior. Do not add a static-key fallback or widen trust.
4. With separate execution approval, perform an identity/read-only-plan pilot in
   an approved environment; prove untrusted subjects cannot assume the role.
   The unresolved sandbox plan is not a pilot deployment candidate. Record
   session/CloudTrail evidence without credentials/tokens; no apply is implied.
5. After owner acceptance of successful authorized runs, remove the workflow's
   key inputs and separately approve revocation of old credentials. Preserve
   evidence and a controlled recovery path; do not retain permanent keys as an
   invisible automated fallback. A failed migration stops deployment.

OIDC removes the need for stored long-lived AWS keys and provides expiring role
sessions; it does not fix excessive role permissions or compromised trusted
workflow code. Trade-offs include trust/configuration errors, token/STS service
dependencies, session expiry and environment-approval availability. Pin reviewed
action revisions and use an attributable session name. The action's supported
role/token settings are documented in its
[v4 credential-action guidance](https://github.com/aws-actions/configure-aws-credentials/blob/v4/README.md).
No role, provider, workflow input, permission or repository setting was changed.
Please approve a separate scoped implementation before any migration work.

### CloudWatch/SNS coverage and delivery status

Backend monitoring is declared directly in `terraform/terraform-backend/main.tf`,
not a separate monitoring module. All three alarms configure both ALARM and OK
actions to `aws_sns_topic.alerts` and use `treat_missing_data=notBreaching`.

| Alarm address | Configured signal / condition | Evidence status |
|---|---|---|
| `aws_cloudwatch_metric_alarm.api_5xx_rate` | API Gateway `5xx` / `Count`, sums over 300 seconds; `IF(requests > 0, 100 * errors / requests, 0)` > 1%, one evaluation period; selected API ID. | **Verified (source)**; live metrics/evaluation/notification **Unverified**. |
| `aws_cloudwatch_metric_alarm.dynamodb_throttles` | Metrics Insights sums `ThrottledRequests` across Operation/TableName for the configured table; 60-second period, > 0, one evaluation period. | **Verified (source)**; query results and alarm state **Unverified**. |
| `aws_cloudwatch_metric_alarm.indexer_iterator_age` | Indexer Lambda `IteratorAge`, Maximum > 60,000 ms, three 60-second periods. | **Verified (source)**; active stream mapping/metrics and delivery **Unverified**. |

There is one SNS topic declaration and zero `aws_sns_topic_subscription`
declarations. The source comment explicitly says no subscriber yet; that does
not prove there are no manually created live subscriptions. Topic existence,
CloudWatch publish permissions, any SNS encryption/KMS grants, confirmed
subscription, recipient consent and end-to-end receipt all remain **Unverified**.
A topic output is not proof of delivery. Email subscriptions require recipient
confirmation; see [CloudWatch notification delivery guidance](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Notify_Users_Alarm_Changes.html).
No recipient details were retrieved and no publish/subscribe/test was executed.

API Gateway access logs are declared with default retention of **14 days** and
detailed metrics/throttling. The format includes source IP and integration error
messages, but does not explicitly include request bodies or Authorization
headers. Review IP/privacy retention and error-message redaction separately;
source formatting cannot guarantee actual messages contain no sensitive data.
Explicit function log-group retention/KMS configuration is not declared here;
actual Lambda log retention is **Unverified**, not assumed unlimited.

Coverage gaps in source include continuous API/SVG correctness checks, Lambda
errors/throttles/duration, import-worker/async queue health, notification failures
and frontend/CloudFront health. Existing #282 smoke tests run after successful
backend CD and #283 artifact checks are offline/build-time, not continuous
monitoring or proof of recipient delivery. Missing-data-as-not-breaching can
leave telemetry loss silent; review a separate heartbeat strategy. The API 5xx
alarm is intended to catch HTTP failures even when handled application errors
do not increment Lambda Errors. Metric availability, thresholds, workload
coverage and ownership must be verified before relying on any of these alarms.

### Security review checklist and approval queue

| Review area | Evidence status | Disposition |
|---|---|---|
| AWS deployment identity / least privilege | **Unverified** effective principal/policies; runtime declarations **Verified**. | **Remediation recommended**: authorized IAM/usage review; policy changes **Require approval**. |
| GitHub Actions permissions | CI/frontend read-only **Verified**; CD defaults **Unverified**. | Explicit CD scope **Remediation recommended**, change **Requires approval**. |
| Secrets handling / Git exposure | Secret references/sensitivity and tracked backup metadata **Verified**; backup contents, credential lifetime and comprehensive history exposure **Unverified**. | Confidential triage **Requires approval**; no secret-value retrieval. |
| Terraform State access | Backend/key/lock source **Verified**; effective bucket IAM/TLS/audit controls **Unverified**. | Owner evidence and scoped roles **Remediation recommended**. |
| Encryption / backups | Asset encryption declarations and historical state AES256 **Verified** at their stated evidence level; current recovery evidence **Unverified**. | State versioning/backup work **Requires approval**. |
| Locking / workspace isolation | Source controls **Verified**; actual acquisition and IAM separation **Unverified**. | Retain #285 gate and complete authorized identity/lock review. |
| Deployment approval boundaries | main/default and delete guard **Verified**; environment gate absent in source, external protections **Unverified**. | Protected deployment review **Remediation recommended**; changes **Require approval**. |
| CI/CD supply-chain exposure | PR/deploy separation **Verified**; mutable tags/tool/dependency gaps **Verified**. | Reviewed pinning and privileged-step isolation **Remediation recommended**. |
| OIDC readiness | Proposed design documented; actual provider/subject/role ownership **Unverified**. | Migration **Requires approval**; do not activate automatically. |
| CloudWatch/SNS delivery | Alarm/topic declarations **Verified**; subscriber/receipt and live settings **Unverified**. | Recipient ownership, confirmation and separately approved test **Require approval**. |
| Logging / redaction | Access-log schema and automation redaction tests **Verified**; actual runtime/log access **Unverified**. | Retention/privacy/diagnostic review **Remediation recommended**. |
| Recovery / incident response | #285 procedures and offline gate **Verified**; backups and exercises **Unverified**. | Resolve drift and obtain separate execution approval; no automatic rollback. |

Priority order: owner-controlled SEC-01 exposure triage; verify credential/state
owners and effective access; establish deployment/alert ownership; then review
OIDC, scoped IAM, recovery/versioning, protected approvals and monitoring changes.
Do not use this queue to bypass #284 drift or #283 frontend state ownership.
Authorization is still needed for any AWS-side metadata collection, confidential
backup inspection, credential action, policy/settings change or alert exercise.
No implementation approval is inferred from this audit request.

### Local validation, scope and completion limits

| Executed check | Result |
|---|---|
| `python -m pytest -q scripts/tests -p no:cacheprovider` | **151 passed**; existing smoke, frontend-preparation and sandbox-gate tests. |
| Backend offline suite, `pytest -v -m "not api" -p no:cacheprovider` | **361 passed, 38 deselected**; AWS environment/config inputs disabled by the existing local helper; live API tests excluded. |
| Both roots through `sandbox_validation.py local` with prior #281 provider/module caches | fmt/validate pass on Terraform 1.15.8; backend 14 existing DynamoDB deprecation warnings, frontend zero. No init, AWS access or state read. |
| actionlint 1.7.12: CI, CD and frontend preparation | Pass; optional external ShellCheck/Pyflakes disabled. |
| Bounded current-source pattern/structure review | 29 files, no listed credential-pattern candidates; CI/frontend permissions and CD trigger/auth structure confirmed; one topic, three alarms, no declared subscription/OIDC provider. Not a comprehensive historical scan. |
| Git metadata-only review | Tracked backup and available-ref filename history confirmed; no backup/state/credential contents read. |
| Diff/scope | `git diff --check` passes; application, Terraform, IAM, workflows and scripts match `feature/v5/sandbox-reproducibility`. Only this report changes. |

No permanent security scanner or new behavior/tests were added: the focused
inspection plus existing redaction/automation tests provide evidence without
introducing an unvalidated broad scanner. Local review helpers remain ignored
under `scratch/`. The checklist and source-backed assessment are complete for
review, **not a security certification or closure of live evidence gaps**.
Effective deployment/state permissions, current backup/encryption controls,
GitHub protections, credential metadata, actual monitoring and alert receipt
remain blocked on separately authorized evidence. OIDC/remediation deployment
is not part of acceptance for this audit-only change. No commit, push, PR,
merge, issue comment, notification or deployment was made for #286. No work on
another issue was performed.

## 11. Existing application only: previous combined-release boundary

**Historical snapshot at `53c7f2f`: superseded by the operator's backend-only
dry-run decision in section 12. Its unconditional frontend blocker and helper
replacement policy are no longer the current implementation.**

This update supersedes earlier manual deployment/live-verification procedures.
CI remains tests/build/Terraform validation, main CD is the sole deployment
entry point, and the sandbox gate is optional offline preparation. The separate
frontend build workflow is removed. No new stack, target IDs, region, role,
credential input or deployment-selection configuration is introduced.

### Existing resource mapping and authority

| Existing deployment | Repository mapping / authority | Current boundary |
|---|---|---|
| Backend Lambda/API | `module.lambda.aws_lambda_function.this`, `.indexer` and `module.api_gateway.aws_apigatewayv2_api.this` in the existing backend S3 state; `backend.tf`, default workspace and approved `TF_VARS_FILE`. | Retain the same Terraform commands and Lambda ZIP mechanism. Planned identities must match existing prior-state values. |
| Backend data/assets | Backend state owns `module.storage` bucket/CDN/objects, DynamoDB, OpenSearch and workload IAM. Existing outputs `api_endpoint` and `cdn_url` reference that API/CDN. | These outputs are **not frontend hosting targets**. No bucket/distribution is created or selected by this tooling. |
| Frontend hosting | Frontend source declares `module.s3_website.aws_s3_bucket.this`, `.aws_cloudfront_distribution.this` and `aws_s3_object.frontend_files`. Root outputs expose bucket/ARN/domain/website URL, but authoritative state and existing distribution ID/owner are unverified. | Stop before deployment. A domain or example tfvars is not an authoritative ID/ownership record. No empty frontend state is initialized and no replacement resources are planned. |
| Frontend files versus floor plans | CI builds `frontend/dist` with its own static files. Backend Terraform owns `building-data/floor-plan` and backend-generated asset URLs. | No frontend sync, SVG overwrite or CloudFront invalidation command exists. Backend-owned prefixes remain excluded from the frontend artifact. |

`scripts/deployment_guard.py frontend-boundary` explicitly returns a blocking
result and exit 1. It does **not** claim to have verified an unknown target.
Guessed bucket/distribution environment variables cannot enable it, and there
is no bypass flag. Main CD calls this before credential configuration, init,
plan or apply, so neither deployment target can be used for a partial release.
Resolving this boundary needs the existing frontend owner's authoritative
state/resource mapping, actual public build configuration, account/region and
bucket/distribution ownership evidence, plus a reviewed implementation change.
None was available under this task's no-AWS/no-state-access restrictions.

### Existing backend update guard and retained mechanism

Main CD keeps its main-only trigger, default workspace, concurrency, credential
inputs and init/validate/plan/apply command strings. Python setup moves before
validation; credentials/settings and Terraform resources are unchanged. At a
future authorized run, the backend plan guard consumes plan JSON over stdin,
the existing action's account output, effective workspace and resolved backend
metadata. It never makes AWS calls, fetches raw state or repairs state itself.
It checks the cached backend against committed `backend.tf`, required locking,
root provider region references, state-scoped ARN account/region consistency,
existing bucket/environment guard inputs and all required backend state anchors.

The same plan must include every prior managed resource, bind each `before`
to prior-state values, preserve IDs/names/ARNs/origins/handlers/runtime and keep
post-apply API/CDN outputs associated with the existing resources. Only no-op
or in-place updates may pass. All managed creates/deletes/replacements,
imports/moves/forget and unreviewed drift fail, as do IAM updates, Lambda
environment changes, partial/errored/deferred plans or missing/conflicting
evidence. Known #284 candidate addresses are reported directly; arbitrary
instance keys are hashed to avoid exposing private metadata. No plan/secret
values are logged or uploaded.

There is deliberately **no local build-helper replacement exemption**. The
existing Lambda mechanism can require `terraform_data.build` replacement on a
code/dependency change, which this strict guard will block too. This preserves
the requested no-create/delete/replace rule without quietly redesigning the
builder. The backend path is therefore not certified ready for a code release;
any policy exception or mechanism change needs separate review. An in-place
code-hash update test proves identity checks, not artifact compatibility or
absence of an application rollback. #284's six deletes and Lambda/auth drift
remain unresolved and are not suppressed.

After a successful approved apply, the unchanged API/SVG smoke step uses outputs
from that root. No new pre-deployment smoke workflow or manual target procedure
is required. An always-run summary reports UTC, commit, run URL and target/
plan/safety/apply/smoke outcomes. It runs no AWS/deployment commands and does not
turn failure/skipped states into success. Only this reporting step uses
`always()`; write/verification steps retain normal success gating.

### Frontend implementation status and required evidence

Frontend build/integrity verification remains operational in CI using locked
dependencies and reserved non-deployment fixture configuration. Its outputs are
not a production-configured release. This task stops frontend CD at validation:
**no real-config CD build, S3 upload, CloudFront invalidation, delivered-file
verification or object-version verification is implemented or claimed**.

Before those operations can be added to main CD, establish authoritative
frontend state and distribution identity without guessing; verify caller,
region, canonical bucket owner, distribution ARN/account and S3 origin/OAC;
approve the existing public build configuration; and resolve object ownership.
Terraform currently declares every frontend object, so an unreviewed direct
S3 writer could introduce drift. Actual bucket versioning, cache policy,
release manifest hashes and rollback/recovery constraints also require evidence.
Do not use backend asset outputs as a substitute, create a new state or grant
new IAM permissions as a workaround. The existing offline artifact tests and
mocked ownership guard are preparation, not proof of live ownership.

No runtime metadata lookup or deployment was executed here. CI success cannot
satisfy these gaps. The full requested combined deployment remains blocked;
this change is safe, fail-closed preparation, not a completed frontend release.

### Local validation and delivery

| Offline validation | Result |
|---|---|
| `python -m pytest -q scripts/tests -p no:cacheprovider` | **185 passed**: 34 existing-deployment guard cases plus the prior 151 automation tests. Covers synthetic existing updates, create/delete/replace rejection, six known deletion addresses, state/account/region/workspace conflicts, missing metadata, guessed frontend targets, private-value redaction and CLI exit codes. |
| Backend non-live suite | **361 passed, 38 live API tests deselected**; credentials/config lookup disabled by the existing offline helper. |
| Isolated locked frontend production build and manifest verification | Pass using reserved test configuration; TypeScript/Vite pass, 146 locked dependencies installed. Existing large-chunk advisory remains. No real deployment target/configuration used. |
| Both Terraform roots using prior provider/module caches | fmt and validate pass on Terraform 1.15.8; backend 14 existing DynamoDB warnings, frontend zero. No init, remote plan or state access. |
| actionlint 1.7.12 | Pass on CI and main CD; optional external ShellCheck/Pyflakes disabled. |
| Workflow structure and local summary execution | Existing main trigger/concurrency/workspace, authentication inputs, init/validate/plan/apply/smoke command strings and CI are unchanged. Target boundary precedes credentials; plan guard precedes apply; smoke has success-only ordering after apply. Summary executed offline with synthetic failed/skipped outcomes. |
| `git diff --check` / scope | Pass. No application, Terraform resource, IAM/credential configuration or existing verifier changes. |

Changed paths: `.github/workflows/cd.yml`, deletion of
`.github/workflows/frontend-build.yml`, `scripts/deployment_guard.py`,
`scripts/tests/test_deployment_guard.py`, and this report. Application code, Terraform
resources/state, IAM, credential configuration, CI and existing smoke/artifact
scripts are unchanged. Historical security findings and recovery guidance are
retained; SEC-03's old delete-only/helper-exemption limitation is superseded by
the stricter guard above, while human approval protection remains unverified.
No AWS call, plan/apply/destroy, raw-state/secret access, resource/asset write,
invalidation, branch creation, new PR, merge or deployment occurred. Delivery is
limited to the user's requested commit/push on `feature/v5/ci-validation` and an
update to existing Draft PR #288, which must remain Draft.

## 12. Authorized backend dry run / frontend build-only iteration

**Latest operator decision:** Backend has the authoritative remote Terraform
state. Frontend has no established state to preserve in this iteration; do not
create, configure, migrate, import or repair one. Backend CD plan inspection may
continue independently of frontend infrastructure. This supersedes section 11's
combined-release blocker and the original request for two Terraform applies.

### Implementation and safety boundaries

- Main CD's existing `push: main`, default workspace, concurrency and AWS
  credential inputs are retained. No V5/feature trigger or dispatch entry is
  added. The unconditional `frontend-boundary` command/step is removed, not
  replaced with a target picker or a bypass flag.
- Backend uses the existing committed S3 backend and `TF_VARS_FILE`. Init is
  readonly for the committed provider lock; Terraform matches CI's 1.15.8 and
  its wrapper is disabled for reliable exit codes/JSON stdin. Account output,
  effective workspace, backend metadata and plan prior-state identities still
  have to agree; absent/mismatched state fails closed.
- Plan uses `-lock=false -detailed-exitcode`: no remote lock is written, 0/2
  proceed to inspection and all other exits fail. This does not reserve state
  against concurrent operations. Its private saved plan is never uploaded,
  retained for deployment or considered approved for apply.
- All AWS infrastructure creates/deletes/replacements and known #284 drift
  remain rejected. Only the existing built-in local Lambda packaging helper can
  be classified separately under the narrow hash/input/ownership checks in
  section 2. Tests prove that helper classification cannot hide an AWS
  replacement. Every result retains `apply_permitted: false`.
- There is **no Apply, Destroy, frontend Terraform init/plan/apply, S3 upload,
  cache invalidation or live smoke step**. Thus no partial deployment can occur;
  there are no applies to sequence. The API/SVG checker and tests are preserved
  for a future separately approved post-deployment phase, not executed here.
- Frontend build and artifact integrity remain in credential-free CI, using
  explicit verification fixtures and existing lock/build conventions. No live
  frontend account/region/bucket/distribution is guessed or validated, and
  infrastructure/deployed-file/version verification is out of scope.
- Summary/cleanup always run locally on the future runner: report UTC, SHA,
  run URL, plan exit/guard outcomes and omitted operations; remove generated
  backend `tfplan`/tfvars. Never upload or echo their contents. Local tests run
  these scripts only in synthetic temporary workspaces, not against private
  developer files.

No extra GitHub configuration is required for this scope. `TF_VARS_FRONTEND`
may be configured but is intentionally unused; writing it is unnecessary and
would not establish ownership. Actual frontend build configuration would need
approved public `VITE_API_BASE_URL`, `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` inputs in a future release. The local private `.env`
and both real tfvars files were neither printed, modified nor committed.

### Final local evidence and delivery status

| Check | Result |
|---|---|
| Python automation tests | **204 passed**. Existing verifier/guard tests plus narrow local-helper classification, AWS replacement rejection, removed frontend-blocker behavior and dry-run workflow regressions. |
| Plan shell exit handling | Mocked Terraform only: plan exit 0/2 accepted for inspection; 1/99 remain failed. No actual plan or provider ran in these tests. |
| Summary and cleanup | Pass in synthetic temporary workspace; private fixture text not logged; only generated fake files removed. |
| Backend tests | **361 passed, 38 live API tests deselected**; AWS credential/config lookups disabled. |
| Isolated frontend build / artifact verification | Pass: existing locked npm install and TypeScript/Vite production build under explicit CI fixture configuration, followed by integrity verification. Existing large-chunk advisory remains. Not a production-configured release. |
| Terraform roots | fmt/validate pass with existing provider/module caches and no init/state access. Backend 14 existing DynamoDB deprecation warnings; frontend zero. No resource/variable/backend source changes. |
| actionlint 1.7.12 | CI and CD pass; optional external ShellCheck/Pyflakes disabled. CI remains unchanged. |
| Scope / whitespace | `git diff --check` passes; application, both Terraform roots, CI and existing smoke/frontend/sandbox utilities unchanged. |

Changed files: `.github/workflows/cd.yml`, `scripts/deployment_guard.py`,
`scripts/tests/test_deployment_guard.py`, new
`scripts/tests/test_cd_dry_run.py`, and this report. No AWS API call, remote
plan, raw-state/secret retrieval, state modification, infrastructure/asset write,
notification or deployment was executed during implementation. Only the
requested commit/push and existing Draft PR #288 update are delivery actions;
no merge, new branch/PR or GitHub Issue modification is authorized.

An actual remote CD dry run and its GitHub run evidence remain pending. The
main-only workflow cannot run this feature-branch implementation without a
separate approved integration; no merge or deployment is performed to obtain
that evidence. #284 destructive drift, Lambda/authentication compatibility,
effective credential permissions and historical state-security/recovery gaps
are not repaired by passing local tests. Frontend infrastructure deployment is
explicitly **not covered by this Dry Run**, not an unfinished stage that will
silently start after a backend plan succeeds.

## 13. Remaining V5 implementation: offline completion and approval boundaries

This update completes the remaining safe implementation work in two isolated
branches. It does not certify a deployed V5 release or authorize execution.
No GitHub Issue was modified. Application files, Terraform resources, frontend
build configuration, existing SVGs and production infrastructure remain unchanged.

### Separate manual dry-run branch targeting main

`feature/v5/manual-backend-dry-run` is based on `origin/main` at `03ffff6`,
prepared in an isolated worktree. Its new `backend-dry-run.yml` has only
`workflow_dispatch`, read-only GitHub token permissions and a main-ref job guard.
It includes exact copies of `deployment_guard.py`, `sandbox_validation.py` and
the focused guard tests from this PR, plus workflow regressions and
`ManualDryRun.md`. Runtime guard dependencies are Python stdlib only.

The workflow reuses the existing backend, default workspace and credential
references. It prepares the existing Linux Lambda package locally before AWS
credentials so cold-checkout archive reads do not require a fictitious ZIP.
It can only init/validate/plan/inspect, with lock-free snapshot semantics,
sanitized reporting and private-file cleanup. It cannot apply/destroy, repair
state, upload frontend files, invalidate caches, publish alerts or run the
post-deployment verifier. Known drift/code mismatches can correctly fail its
guard; readiness does not mean every actual plan will pass.

The branch leaves main's production `cd.yml`, CI, application and Terraform
files unchanged; tests check the production workflow's normalized checksum.
Pushing the feature branch does not trigger production. No separate PR is
created automatically; the branch is prepared for human review targeting main.

**Installation requires an explicit owner decision:** GitHub needs the manual
workflow on the default branch before dispatch is available. Existing main CD
matches every main push and still applies. Therefore merging even this small
branch could trigger production. No merge, skip/disable workaround, settings
change or workflow execution is performed. Coordinate a separately approved
installation that prevents production execution; do not claim that a manual-only
new file disables the independent production workflow.

### #284 minimum safe changes and remaining drift

All six async-import deletion candidates remain unchanged in Terraform and
state. Missing definitions cannot establish obsolescence. Offline reconciliation
cannot decide which application/infrastructure release should own them. No
feature restoration, imports, state removal/migration or targeted plan is added.
The guard continues to report the known addresses and rejects their deletion.

The additional safe fix is to reject Lambda package changes even when the
function identity is unchanged. Changed/deferred `source_code_hash`, local ZIP,
S3 package inputs or container-image URI now report
`lambda_artifact_compatibility_unverified`. Code and authentication-environment
risks are recorded together, without their values. A local packaging-helper
replacement is still recognized separately, only with the existing builtin
provider/address, exact prior-state binding, null input and known changed
SHA-256 triggers. This never exempts an accompanying AWS replacement or grants
apply permission.

The packaging helper's archive data source needs local build output on a cold
runner. The new manual workflow reuses the original builder; no Terraform block
is changed. Unpinned transitive packages, Docker availability, archive metadata
and source line endings can affect hashes. Building a package does not prove
compatibility with the deployed async implementation. Actual current actions
require a refreshed, explicitly authorized read-only plan and trusted deployed/
proposed artifact evidence. No remote plan or deployed ZIP was retrieved here.

### Frontend path: verified source facts, no speculative writer

The configured hosting is a private S3 bucket behind CloudFront/OAC; Terraform
source declares one managed object per `dist/` file. The operator confirmed no
established frontend state is to be created or preserved this iteration. The
actual operator/tool that uploaded the live site and the bucket/distribution
ownership are not established by source or tfvars. Consequently neither an
empty-state Terraform apply nor a parallel direct S3 sync is a safe inference.
No frontend deployment writer is introduced.

Existing locked CI build/integrity checks remain intact. The new non-destructive
portion verifies the approved frontend's root HTML and every static file against
the exact trusted manifest hashes/sizes and expected content types. It detects
old HTML, stale JS/SVG and SPA 200 fallbacks; it never mixes these with backend
floor-plan objects or overwrites any SVG. It checks served bytes, not S3
VersionId history, cache age, browser execution or external Leaflet bodies.
Live ownership/configuration and object-version provenance remain evidence gaps.

### Prepared post-deployment verification contract

`scripts/post_deployment_verify.py` coordinates the existing API/SVG checker and
frontend integrity verification. It is not called from either dry-run workflow.
Before **any HTTP request**, it requires an explicitly authorized successful
deployment receipt, verified-target assertion, approval/run provenance, matching
full commit in a clean frontend manifest, local artifact integrity and a clean,
tracked backend asset checkout at that same commit. Missing/failed/dry-run
receipts and dirty/mismatched baselines fail locally. There is no bypass option.

The receipt is private, trusted operator/pipeline input, **not a cryptographic
approval or independent AWS ownership attestation**. The verifier does not query
GitHub to authenticate a supplied status or discover resource IDs. A future
protected, explicitly approved post-apply process must produce it and the
immutable release artifact. Never fabricate a receipt from CI success or accept
one from an untrusted PR artifact. Required receipt fields:

| Field | Required evidence |
|---|---|
| `mode`, `authorized`, `status`, `targets_verified` | Exactly `deployment`, true, `success`, true, from the approved deployment process. Dry runs cannot qualify. |
| `commit` | Full lowercase 40-character deployment SHA; must equal manifest revision and backend asset checkout HEAD. |
| `approval_reference`, `deployment_run_url` | Actual approval provenance and HTTPS run URL; no credentials or signed query values. |
| `backend.api_base_url`, `backend.asset_base_url` | Approved existing endpoint/CDN bases from the deployed environment, never guesses. |
| `frontend.base_url` | Approved existing root website origin after independent ownership verification. |

Future post-deployment call interface (not executed here):

```text
python scripts/post_deployment_verify.py --receipt <private-approved-receipt.json> --artifact <approved-release-directory> --assets-dir <clean-release-checkout>/building-data
```

Only GET is used. It verifies the sampled public API/building/floor contract,
backend SVG origin/path/XML/MIME/content, then frontend root and static assets.
Redirects are refused by the reused HTTP client. Failed checks report the actual
phase as failed and later phases as not run. Output contains only static status/
failure categories, never targets, bodies, tokens or exception text. Exit 0 is
sampled verification success, 1 a remote/content failure, 2 missing/untrusted
prerequisites. No retry deployment, rollback, resource write or notification
exists. A future job can append this sanitized JSON to its run summary; current
dry-run summaries remain separate and do not claim post-deployment success.

### Focused validation and consolidated blockers

| Local validation | Result |
|---|---|
| PR #288: `test_deployment_guard.py` and `test_post_deployment_verify.py` | **74 passed**: 51 guard cases and 23 receipt/API/SVG/frontend verification cases. All HTTP is mocked; Git baseline cases use local metadata mocks. |
| Main-based branch: guard and manual-workflow tests | **56 passed**. Production workflow checksum preserved, manual-only/main-ref gating, no write/live-verification path, cold package step before credentials and complete guard dependencies checked. |
| New manual workflow actionlint 1.7.12 | Pass; optional external ShellCheck/Pyflakes disabled. |
| Scope/diff | Both branches pass `git diff --check`. Main-based production CD/CI/application/Terraform match `origin/main`; PR #288 application/Terraform/build configuration and dry-run workflow are unchanged. Copied runtime guard files match PR #288 exactly. |

No full 204-test
automation run, 361-test backend suite or frontend build is repeated: only
changed guard/coordinator/workflow cases are relevant. No Terraform configuration
or frontend build configuration changed, so fmt/validate/build repetitions are
unnecessary. Whitespace/scope checks cover both branches.

| Pending item | Evidence/approval required |
|---|---|
| Manual workflow installation/run | Separate main-target review, an installation plan preventing the existing production push workflow, then explicit authorization for a manual read-only run. No merge/dispatch occurred. |
| Backend drift and code baseline | Fresh authorized remote plan, caller/state/region evidence, decision on the six deployed async resources and trusted artifact/authentication compatibility review. No destructive reconciliation is implemented. |
| Frontend release writer | Existing bucket/distribution/account/region ownership, current public build configuration, actual object writer/versions/cache behavior and owner approval of a non-conflicting release path. No state or infrastructure provisioning workaround. |
| Actual deployment | Explicit reviewed human approval and production protections; dry-run code does not confer permission. Existing main security findings remain applicable. |
| Live post-deployment evidence | Successful authorized deployment receipt/run, immutable frontend manifest, matching clean asset baseline and actual API/frontend/SVG results. Fixtures are not live evidence. |

#278 is **not fully satisfied** by local code: CI/source implementation and
offline protections are prepared, but live post-deployment evidence, an
ownership-backed frontend release decision and approved production integration
are outstanding. Sandbox recreation/repeat apply is not reintroduced as a
closure requirement. Keep PR #288 Draft; no Issue status is changed.

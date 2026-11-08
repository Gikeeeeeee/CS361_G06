# Deploy Flow

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

## 1. Configure AWS Credentials

Configure your AWS IAM credentials using the AWS CLI or set them as environment variables:

### Option 1: AWS CLI (Recommended)
```bash
aws configure
```

### Option 2: Environment Variables
#### macOS / Linux / Git Bash:
```bash
export AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="YOUR_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="ap-southeast-2"
```

#### Windows PowerShell:
```powershell
$env:AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY_ID"
$env:AWS_SECRET_ACCESS_KEY="YOUR_SECRET_ACCESS_KEY"
$env:AWS_DEFAULT_REGION="ap-southeast-2"
```

### Verify Credentials:
```bash
aws sts get-caller-identity
```

---

## 2. Setup & Deploy via Terraform

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/Gikeeeeeee/CS361_G06.git
   cd CS361_G06
   ```

2. **Go to terraform-backend directory & create `terraform.tfvars`:**
   ```bash
   cd terraform/terraform-backend
   ```
   * *Linux / macOS / Git Bash:* `cp terraform.tfvars.example terraform.tfvars`
   * *Windows PowerShell:* `Copy-Item terraform.tfvars.example terraform.tfvars`

3. **Edit `terraform.tfvars`:**
   Set globally unique names and keep the project name, DynamoDB table, and
   OpenSearch index consistent:
   ```hcl
   aws_region          = "us-east-1"
   bucket_name         = "cs361-g06-building-data-yourname-123"
   project_name        = "CS361-G06-yourname"
   environment         = "dev"
   dynamodb_table_name = "CS361-G06-yourname-data-dynamodb"
   opensearch_index    = "university-yourname"
   ```

   For the existing shared `rickoroxd` environment, use these exact values:
   ```hcl
   project_name        = "CS361-G06-rickoroxd"
   dynamodb_table_name = "CS361-G06-rickoroxd-data-dynamodb"
   opensearch_index    = "university-rickoroxd"
   ```

4. **Initialize Terraform:**
   ```bash
   terraform init -reconfigure
   ```

   The backend is stored in the S3 bucket configured in `backend.tf`. Do not
   initialize this directory with a different bucket or state key.

5. **Plan before applying:**
   ```bash
   terraform plan -out=tfplan
   ```

   Review resource names carefully. An existing deployment should not show
   replacement of resources merely because `project_name` changed.

6. **Apply the reviewed plan:**
   ```bash
   terraform apply tfplan
   ```

Terraform builds both Lambda ZIP files inside the Lambda Python 3.12 Docker
image. If Docker is stopped, the build fails before Lambda is updated.

### Updating only the existing Lambdas

For an old application version or a recovery after a failed deployment, keep
the existing resource names and target only the two Lambda functions:

```bash
terraform plan \
  -var='project_name=CS361-G06-rickoroxd' \
  -var='opensearch_index=university-rickoroxd' \
  -target='module.lambda.aws_lambda_function.this' \
  -target='module.lambda.aws_lambda_function.indexer' \
  -out=/tmp/cs361-lambda.plan

terraform apply /tmp/cs361-lambda.plan
```

Targeting is for recovery or a narrowly scoped Lambda update. Run a normal
full plan afterward to review any remaining changes.

### Automatic deploy (GitHub Actions CD)

`.github/workflows/cd.yml` applies the `default` workspace on every push to
`main`, and only `main`. It needs these repository secrets (team AWS account):

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | team deploy credentials |
| `AWS_SESSION_TOKEN` | only for temporary credentials; otherwise leave unset |
| `TF_VARS_FILE` | the full contents of the team's `terraform.tfvars` |

CD stops before applying if the plan deletes or replaces any AWS resource.
That usually means wrong state or wrong variables. Review the plan locally
and apply it by hand if the delete is intended.

---

## 3. Test the API

After deployment finishes, Terraform will output your API endpoints:

### Query Building Summary:
```bash
# Example query for building LC4
curl https://<api_endpoint>/buildings/LC4
```

#### Expected Response:
```json
{
  "id": "lc4",
  "name": "LC4",
  "latitude": 14.072606976041664,
  "longitude": 100.60772614298118,
  "floors": [
    {
      "id": "floor-uuid",
      "floor_number": 1
    },
    {
      "id": "floor-uuid",
      "floor_number": 3
    }
  ]
}
```

### Query Floor Details & SVG Map:
```bash
# Example query for floor details (by floorId or floorNumber)
curl https://<api_endpoint>/buildings/LC4/floors/1
# or
curl https://<api_endpoint>/buildings/LC4/floors/floor-uuid
```

#### Expected Response:
```json
{
  "id": "floor-uuid",
  "floor_number": 1,
  "map": {
    "type": "svg",
    "url": "https://<bucket_name>.s3.amazonaws.com/floor-plan/LC4/LC4-floor1-neutral.svg?AWSAccessKeyId=..."
  },
  "rooms": [
    {
      "id": "room-uuid",
      "room_number": null,
      "name": "LAB102",
      "type": "LAB",
      "latitude": 14.072882788956523,
      "longitude": 100.6077629190076
    }
  ],
  "facilities": [
    {
      "id": "facility-uuid",
      "name": "Stair 1",
      "type": "STAIR",
      "latitude": 14.072411879255112,
      "longitude": 100.6077843766784
    }
  ]
}
```

---

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

### CD and CI integration

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

### Local execution and result handling

Offline tests, requiring no endpoint or credentials:

```bash
python -m pytest -v scripts/tests -p no:cacheprovider
```

For an explicitly approved read-only target, configure the verified outputs as
`API_BASE_URL` and `ASSET_BASE_URL`, then run:

```bash
python scripts/smoke_test.py
# Equivalent explicit configuration; shell variables must be set first:
python scripts/smoke_test.py --api-base-url "$API_BASE_URL" --asset-base-url "$ASSET_BASE_URL"
```

Use `--help` for optional discovery-validated selection, `--timeout` (positive,
finite seconds per request; default 10) and `--assets-dir` for a trusted release's
asset directory. Base URLs must be HTTPS with no userinfo, query or fragment.
No retries or live test calls are performed by the offline test suite.

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
merge or deployment. Draft PR #288 is unchanged. No work on #283 was performed.

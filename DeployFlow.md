# Deploy Flow

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
| `module.api_gateway.aws_apigatewayv2_route.get_schedule_import_job` | Removes import-job status route. |
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

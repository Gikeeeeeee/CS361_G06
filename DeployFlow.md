# Deploy Flow

## V5 verification status

The current evidence and requirement matrix are in
[V5FinalVerification.md](V5FinalVerification.md). The verified V5 path is PR CI
plus the manual backend **dry run**, not production deployment.

- [CI](.github/workflows/ci.yml) runs on PRs targeting `main` or `V4`: backend
  tests excluding live API tests, focused guard/asset-checker tests, backend
  Terraform validation with `init -backend=false`, and frontend lint, SVG loading
  regressions, mocked corridor tests, production build and SVG integrity checks.
- [Manual Backend Terraform Dry Run](.github/workflows/backend-dry-run.yml)
  runs only by dispatch on `main`. It builds the existing Linux Lambda package
  locally, then initializes the existing backend, validates, plans with
  `-lock=false`, and inspects the plan with the Deployment Guard. It never applies,
  uploads frontend files, invalidates CloudFront or modifies Terraform state.
- [Run 42634534227](https://github.com/Gikeeeeeee/CS361_G06/actions/runs/42634534227)
  validated and planned successfully at `c135c16`, then correctly blocked four
  safety findings. This is evidence of a working refusal, not deployment readiness.
- The frontend website belongs in `terraform/terraform-frontend` under
  `module.s3_website`; building JSON/SVG/images and their CDN belong in the backend
  stack under `module.storage`. Live frontend state ownership is unverified.
  No additional infrastructure pipeline is introduced.
- GitHub reported the original `CD` workflow as `disabled_manually` during this
  review. Its source still contains a main-push apply job. Do not enable it or
  treat this verification PR as deployment approval.

The deployment/recovery examples below are manual reference material. No apply,
targeted recovery, state migration or teardown is part of V5 final verification.

## Prerequisites
1. [Git](https://git-scm.com/)
2. [AWS CLI v2](https://aws.amazon.com/cli/)
3. [Terraform (>= 1.5.0)](https://developer.hashicorp.com/terraform/install)
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

GitHub currently reports `.github/workflows/cd.yml` as `disabled_manually`.
Its unchanged source would apply the `default` workspace on pushes to `main`
if re-enabled. It references these repository secrets (team AWS account):

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | team deploy credentials |
| `AWS_SESSION_TOKEN` | only for temporary credentials; otherwise leave unset |
| `TF_VARS_FILE` | the full contents of the team's `terraform.tfvars` |

The legacy CD guard checks AWS deletes/replacements only. It is distinct from
the stronger Deployment Guard in the manual dry run and does not establish
Lambda compatibility, drift review or approval of new AWS resources. Keep the
original CD disabled; resolving the documented blockers requires separate review.

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
To terminate all created AWS resources:
```bash
cd terraform/terraform-backend
terraform destroy -auto-approve
```

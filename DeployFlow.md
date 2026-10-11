# Deploy Flow (AWS Academy Learner Lab)

## Prerequisites
1. [Git](https://git-scm.com/)
2. [AWS CLI v2](https://aws.amazon.com/cli/)
3. [Terraform (>= 1.5.0)](https://developer.hashicorp.com/terraform/install)
4. [Docker Desktop](https://www.docker.com/products/docker-desktop/)

Docker must be running when Terraform builds the Lambda package. It provides the
Linux Python 3.12 environment used by AWS Lambda; installing dependencies from
macOS can produce incompatible native binaries.

---

## 1. Configure AWS Credentials (Learner Lab)

In AWS Academy Learner Lab, click **AWS Details** -> **AWS CLI** -> **Show**, copy the credentials and set them in your terminal:

### macOS / Linux / Git Bash:
```bash
export AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="YOUR_SECRET_ACCESS_KEY"
export AWS_SESSION_TOKEN="YOUR_SESSION_TOKEN"
export AWS_DEFAULT_REGION="us-east-1"
```

### Windows PowerShell:
```powershell
$env:AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY_ID"
$env:AWS_SECRET_ACCESS_KEY="YOUR_SECRET_ACCESS_KEY"
$env:AWS_SESSION_TOKEN="YOUR_SESSION_TOKEN"
$env:AWS_DEFAULT_REGION="us-east-1"
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

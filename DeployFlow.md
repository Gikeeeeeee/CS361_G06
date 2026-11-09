# Deploy Flow

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
To terminate all created AWS resources:
```bash
cd terraform/terraform-backend
terraform destroy -auto-approve
```

---

## 5. V5 Deployment Automation & Safe Verification Runbook

### 5.1 V5 Preconditions & Environment Prerequisites
ก่อนเริ่มกระบวนการปล่อยระบบ (Deploy) หรือตรวจสอบระบบใน V5 ต้องจัดเตรียมสภาพแวดล้อมดังนี้:
1. **Node.js (>= 18.x) & npm:** สำหรับ build และทดสอบระบบ Frontend และรัน SVG verification
2. **Python (>= 3.10):** สำหรับรันชุดสคริปต์ความปลอดภัยและการทดสอบ (`scripts/deployment_guard.py`, `scripts/smoke_test.py`, `scripts/frontend_release.py`, `scripts/sandbox_validation.py`)
3. **Terraform (>= 1.5.0):** รองรับทั้ง 2 Stacks (`terraform/terraform-backend` และ `terraform/frontend`)
4. **AWS Credentials:** มีสิทธิ์ IAM ที่เหมาะสมตาม Least Privilege สำหรับ S3, CloudFront, Lambda, API Gateway, DynamoDB
5. **Terraform Remote State:** กำหนดค่า S3 bucket และ DynamoDB table สำหรับล็อค State เพื่อป้องกัน race condition

### 5.2 CI/CD Pipeline Architecture & Policies
1. **Automated CI Validation (`.github/workflows/ci.yml`):**
   - ทำงานทุกครั้งที่มีการเปิด Pull Request (PR) หรือ Push ไปยัง Feature branch
   - ตรวจสอบ Frontend: `npm run lint`, `npm run test`
   - ตรวจสอบ Backend: `flake8`, `pytest`
   - ตรวจสอบ Terraform: รัน `terraform fmt -check` และ `terraform validate` ทั้ง 2 Stacks (`terraform/terraform-backend` และ `terraform/frontend`)
2. **Main-only Continuous Deployment (`.github/workflows/cd.yml`):**
   - อนุญาตให้ปล่อยระบบขึ้น Cloud ได้จาก branch `main` เท่านั้น
   - มีระบบความปลอดภัย (Deployment Guard) ตรวจสอบความถูกต้องและป้องกันการทำลายข้อมูลเดิม
3. **Backend Safe Dry-Run (`.github/workflows/backend-dry-run.yml`):**
   - รองรับการทริกเกอร์แบบ Manual (`workflow_dispatch`) เพื่อรัน `terraform plan` และตรวจสอบ Resource Changes ก่อนการ Apply จริง

### 5.3 Reproducible Commands (คำสั่งที่สามารถรันตามได้จริงทุกขั้นตอน)

#### ขั้นตอนที่ 1: ตรวจสอบความถูกต้องระดับ Local ก่อนสร้าง PR (Local Validation)
```bash
# 1.1 ตรวจสอบ Frontend Code & Test
cd frontend
npm ci
npm run lint
npm run test
cd ..

# 1.2 ตรวจสอบความถูกต้องของ Terraform ทั้งสอง Stack
terraform -chdir=terraform/terraform-backend init -backend=false
terraform -chdir=terraform/terraform-backend validate

terraform -chdir=terraform/frontend init -backend=false
terraform -chdir=terraform/frontend validate
```

#### ขั้นตอนที่ 2: ตรวจสอบและเตรียมปล่อยระบบ Frontend (Frontend Release & SVG Verification)
```bash
# ตรวจสอบความถูกต้องของไฟล์ SVG และ assets ก่อนการ Build/Deploy
python scripts/frontend_release.py --verify-only

# Build และทดสอบความเข้ากันได้ของ Asset แผนผังอาคาร
npm --prefix frontend run build
```

#### ขั้นตอนที่ 3: ตรวจสอบความปลอดภัย Backend ด้วย Dry-Run (Deployment Guard)
```bash
# รัน Deployment Guard เพื่อตรวจสอบว่าไม่มีการลบหรือแทนที่ Production Resource สำคัญ
python scripts/deployment_guard.py --stack backend --dry-run
```

#### ขั้นตอนที่ 4: การทดสอบในสภาพแวดล้อมจำลอง (Sandbox Validation & Reproducibility)
```bash
# สลับไปใช้ Sandbox Workspace เพื่อทดสอบการ Apply โดยไม่กระทบ Production State
cd terraform/terraform-backend
terraform workspace select sandbox || terraform workspace new sandbox
terraform plan -out=sandbox.tfplan
# ทำการ Apply ใน Sandbox เมื่อผ่านการตรวจสอบ
# terraform apply sandbox.tfplan
cd ../..
```

#### ขั้นตอนที่ 5: ทดสอบการทำงานของระบบหลังปล่อย (Post-Deployment Smoke Tests)
```bash
# รันชุดทดสอบ Smoke Test อัตโนมัติเพื่อตรวจสอบ Endpoint อาคาร, ชั้น, และแผนผัง SVG
python scripts/smoke_test.py --base-url https://<api_endpoint> --verify-svg
```

### 5.4 Safety Policies & Boundaries (Tested vs Untested)
- **ส่วนที่ผ่านการทดสอบจริงแล้ว (Tested):**
  - Unit Tests & Linting ทั้ง Frontend และ Backend
  - การตรวจสอบ Syntax และ Configuration ของ Terraform ทั้ง 2 Stacks
  - การทำงานของสคริปต์ Deployment Guard และ Backend Dry-run
  - การตรวจสอบความถูกต้องของไฟล์ SVG แผนผังอาคาร
  - การจำลองการ Deploy บน Sandbox Workspace
- **ส่วนที่ยังไม่ได้ทำหรืออยู่นอกขอบเขต (Untested / Limitations):**
  - การทำ Automatic Production Apply สำหรับ Backend Stack (ยังคงต้องใช้ Manual Approval และผ่านการตรวจสอบ Plan อย่างละเอียดเพื่อความปลอดภัยต่อข้อมูลจริง)
  - ยังไม่รองรับการ Rollback อัตโนมัติในระดับ Infrastructure กรณีการ Deploy ไม่สมบูรณ์

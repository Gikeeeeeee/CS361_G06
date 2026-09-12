# CI/CD Handover Guide — Automated Testing

คู่มือสำหรับผู้รับผิดชอบการ Implement CI/CD บน **GitHub Actions** เพื่อนำ Test Suite ไปตั้งค่าใน Pipeline ได้อย่างรวดเร็วและถูกต้อง

---

## 1. โครงสร้างชุดทดสอบ (Testing Hierarchy)

| ชั้นการทดสอบ (Pyramid) | Directory / File | Pytest Marker | วัตถุประสงค์ | ต้องใช้ AWS หรือไม่? |
|---|---|---|---|---|
| **Unit Tests (Core)** | `tests/unit/services/`<br>`tests/unit/models/` | `unit` | ตรวจสอบ Business logic ของแต่ละ Domain | ❌ ไม่ต้อง (ใช้ FakeSource) |
| **Handler Tests** | `tests/unit/handler/` | `handler`, `unit` | ตรวจสอบการแปลง Event, Status Codes, CORS, และ Error Formatting | ❌ ไม่ต้อง (ใช้ FakeSource) |
| **Integration Tests** | `tests/integration/test_handler_service_integration.py` | `integration` | ตรวจสอบการต่อสาย (Composition Root) ระหว่าง Handler -> Services -> Ports | ❌ ไม่ต้อง (Zero S3 dependency) |
| **API Contract Tests** | `tests/integration/test_api_contract.py` | `api` | ตรวจสอบ Endpoint จริงบน AWS (รองรับ SigV4 IAM) | ✅ ต้องใช้ `API_BASE_URL` (+ IAM Creds) |

---

## 2. คำสั่ง Pytest ที่แนะนำสำหรับแต่ละ Stage ใน CI/CD

### Stage 1: Pull Request & Push Check (Fast Feedback — รัน < 1 วินาที)
สำหรับรันทุกครั้งที่มีการเปิด PR หรือ Push โค้ด ไม่ต้องต่อเน็ตและไม่ต้องมี AWS Credentials:
```bash
cd backend
pytest -v -m "not api"
```
*(จะรันทั้งหมด 60 ข้อ ครอบคลุม Unit, Handler, และ Hexagonal Integration)*

---

### Stage 2: Post-Deploy / Nightly API Verification (Live Contract Check)
สำหรับรันหลังขั้นตอน `terraform apply` หรือสั่งรันแบบ Manual:

**วิธีที่ 1: ส่งผ่าน CLI Argument โดยตรง (แนะนำสำหรับการรันคำสั่ง):**
```bash
cd backend
pytest tests/integration/test_api_contract.py -v --api-url "https://xxxx.execute-api.us-east-1.amazonaws.com"
```

**วิธีที่ 2: กำหนดผ่าน Environment Variable:**
```bash
# Linux / macOS / GitHub Actions
API_BASE_URL="https://xxxx.execute-api.us-east-1.amazonaws.com" pytest tests/integration/test_api_contract.py -v -m api

# Windows PowerShell
$env:API_BASE_URL="https://xxxx.execute-api.us-east-1.amazonaws.com"; pytest tests/integration/test_api_contract.py -v -m api
```
*(หากไม่ได้ส่ง `--api-url` หรือไม่ได้กำหนดตัวแปร `API_BASE_URL` ตัว Pytest จะ `SKIPPED` อัตโนมัติโดยไม่ทำให้ Build แดง)*

---

## 3. Environment Variables, CLI Arguments & GitHub Secrets

| ตัวแปร / Argument | ช่องทางที่ส่งได้ | ความจำเป็น | คำอธิบาย |
|---|---|---|---|
| `API_BASE_URL` หรือ `--api-url` | CLI Option (`--api-url`) หรือ Env Var (`API_BASE_URL`) | จำเป็นสำหรับ `api` test | URL ของ API Gateway เช่น `https://xxxx.execute-api.us-east-1.amazonaws.com` (ได้จาก `terraform output -raw api_endpoint`) |
| `USE_IAM_AUTH` | Env Var (`USE_IAM_AUTH`) | Optional (default: `false`) | ตั้งค่าเป็น `true` หาก API Gateway เปิดใช้ `AWS_IAM` Authorization |
| `AWS_ACCESS_KEY_ID` | Env Var หรือ GitHub Secret | จำเป็นหากใช้ IAM SigV4 | AWS Access Key จาก Learner Lab หรือ IAM User |
| `AWS_SECRET_ACCESS_KEY` | Env Var หรือ GitHub Secret | จำเป็นหากใช้ IAM SigV4 | AWS Secret Key จาก Learner Lab หรือ IAM User |
| `AWS_SESSION_TOKEN` | Env Var หรือ GitHub Secret | จำเป็นสำหรับ Learner Lab | AWS Session Token (มีอายุ ~4 ชม.) |
| `AWS_DEFAULT_REGION` | Env Var (default: `us-east-1`) | Optional | AWS Region ที่ deploy API Gateway |

---

## 4. ตัวอย่าง GitHub Actions Workflows

### Workflow 1: รัน Unit & Handler Tests ทุก PR (`.github/workflows/test.yml`)
```yaml
name: Test Suite (Unit & Handler)

on:
  push:
    branches: [ main, v1-known-issue ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    name: Run Unit & Handler Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Python 3.13
        uses: actions/setup-python@v5
        with:
          python-version: "3.13"
          cache: "pip"

      - name: Install Test Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install pytest boto3 requests

      - name: Run Tests
        run: |
          cd backend
          pytest -v -m "not api"
```

---

### Workflow 2: รัน Live API Tests ด้วย IAM Credentials (`.github/workflows/api-test.yml`)
```yaml
name: API Contract Tests

on:
  workflow_dispatch: # รันแบบกดปุ่มจาก GitHub Web UI
  # หรือ trigger หลัง deploy สำเร็จ

jobs:
  api-contract-tests:
    name: Run API Tests with IAM
    runs-on: ubuntu-latest

    env:
      API_BASE_URL: ${{ secrets.API_BASE_URL }}
      USE_IAM_AUTH: "true"
      AWS_DEFAULT_REGION: "us-east-1"

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Python 3.13
        uses: actions/setup-python@v5
        with:
          python-version: "3.13"

      - name: Install Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install pytest boto3 requests

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-session-token: ${{ secrets.AWS_SESSION_TOKEN }} # สำหรับ Learner Lab
          aws-region: ${{ env.AWS_DEFAULT_REGION }}

      - name: Run API Tests
        run: |
          cd backend
          pytest tests/integration/test_api_contract.py -v --api-url "${{ secrets.API_BASE_URL }}"
```

---

## 5. หมายเหตุด้านสถาปัตยกรรม (Architectural Notes)

1. **การย้ายขึ้น DynamoDB ในอนาคต:**
   - Handler Tests และ Integration Tests ผูกกับ `ports.building_source.BuildingSource` (ผ่าน `Dependencies(source)`) เท่านั้น
   - การเปลี่ยน Storage Adapter จาก `BuildingRepository` (S3) ไปเป็น `DynamoDBRepository` จะไม่ทำให้ Test เหล่านี้พังแม้แต่ข้อเดียว
   - ตัดการเทสต์ S3 ออกตามข้อตกลง เพื่อให้ไปเพิ่ม `test_dynamodb_repository.py` ในรอบการทำ DynamoDB โดยตรง

2. **การเพิ่มตารางเรียน (Schedule / Timetable):**
   - ชุดทดสอบใน `test_room_route.py` และ `test_api_contract.py` ละเว้นการ assert ฟิลด์ `schedule` และ `event` ไว้ชั่วคราว
   - เมื่อ Data Contract สรุปชื่อฟิลด์และโครงสร้างที่แน่นอน สามารถเพิ่ม Assertion เฉพาะส่วนนั้นได้โดยไม่กระทบ Test เดิม

# Deploy Flow (AWS Academy Learner Lab)

## Prerequisites
1. [Git](https://git-scm.com/)
2. [AWS CLI v2](https://aws.amazon.com/cli/)
3. [Terraform (>= 1.5.0)](https://developer.hashicorp.com/terraform/install)

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

2. **Go to terraform directory & create `terraform.tfvars`:**
   ```bash
   cd terraform
   ```
   * *Linux / macOS / Git Bash:* `cp terraform.tfvars.example terraform.tfvars`
   * *Windows PowerShell:* `Copy-Item terraform.tfvars.example terraform.tfvars`

3. **Edit `terraform.tfvars`:**
   Set a globally unique bucket name (e.g. append your student ID or random string):
   ```hcl
   aws_region   = "us-east-1"
   bucket_name  = "cs361-g06-building-data-yourname-123" # Must be globally unique
   project_name = "CS361-G06"
   environment  = "dev"
   ```

4. **Initialize & Deploy:**
   ```bash
   terraform init
   terraform plan
   terraform apply -auto-approve
   ```

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
terraform destroy -auto-approve
```
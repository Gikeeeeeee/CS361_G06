#Deploy Flow 

## Prerequisites
1. Git
2. AWS CLI
3. Terraform

## Configuration AWS Credential

### Option A สำหรับ AWS Account ปกติ
1. ``aws configure``
2. verify crendentail ``aws sts get-caller-identity``

### Option B สำหรับ AWS Academy Learner Lab
1. เปิด terminal พิมพ์คำสั่ง
```
export AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY_ID" 
export AWS_SECRET_ACCESS_KEY="YOUR_SECRET_ACCESS_KEY" 
export AWS_SESSION_TOKEN="YOUR_SESSION_TOKEN" 
export AWS_DEFAULT_REGION="us-east-1"
```
หรือเข้าไป edit ใน 
`` ~/.aws/credentials ``

2. verify crendentail ``aws sts get-caller-identity``

## Start

1. ``git clone https://github.com/Gikeeeeeee/CS361_G06.git``
2. ``cd CS361_G06``
3. Configure Terraform ``cd terraform``
4. ``cp terraform.tfvars.example terraform.tfvars``
5. edit ``nano terraform.tfvars`` ต้องใช้ bucket_name ที่ Unique
Example:
```
aws_region = "us-east-1" 
bucket_name = "cs361-g06-building-data-unique-name" **edit to unique name**
project_name = "CS361-G06" 
environment = "dev"
```
6. ``terraform init``
7. ``terraform plan``
8. ``terraform apply``
9. ถ้าต้องการ terminate ให้ ``terraform destroy``
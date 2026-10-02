terraform {
  backend "s3" {
    bucket       = "cs361-g06-terraform-state"
    key          = "terraform/backend/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
  }
}
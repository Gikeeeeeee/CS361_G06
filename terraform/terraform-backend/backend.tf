terraform {
  backend "s3" {
    bucket       = "cs361-g06-terraform-state"
    key          = "terraform/backend/terraform.tfstate"
    region       = "ap-southeast-2"
    use_lockfile = true
  }
}
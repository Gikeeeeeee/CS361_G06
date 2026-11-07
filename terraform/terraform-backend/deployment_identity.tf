# Keep the shared application and the sandbox in separate state/asset stacks.
# Preconditions fail the plan even when an origin change would be in-place and
# therefore would pass the CD workflow's destructive-change check.
locals {
  deployment_identities = {
    default = {
      bucket_name = "cs361-g06-building-data-v3-test"
      environment = "dev"
    }
    sandbox = {
      bucket_name = "cs361-g06-building-data-v3-test-sandbox"
      environment = "sandbox"
    }
  }
  deployment_identity = lookup(local.deployment_identities, terraform.workspace, null)
}

resource "terraform_data" "deployment_identity" {
  input = {
    workspace   = terraform.workspace
    bucket_name = var.bucket_name
    environment = var.environment
  }

  lifecycle {
    precondition {
      condition = try(
        var.bucket_name == local.deployment_identity.bucket_name &&
        var.environment == local.deployment_identity.environment,
        false
      )
      error_message = "Workspace and deployment variables do not match. default requires MAIN bucket cs361-g06-building-data-v3-test with environment dev; sandbox requires cs361-g06-building-data-v3-test-sandbox with environment sandbox. Other workspaces require an explicitly reviewed deployment identity."
    }
  }
}

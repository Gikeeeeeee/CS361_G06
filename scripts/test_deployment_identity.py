"""Exercise the actual workspace guard without AWS, a remote backend, or apply.

Run: python scripts/test_deployment_identity.py
Requires Terraform on PATH. Every test run uses command=plan and the built-in
terraform_data provider inside a temporary local directory.
"""

import json
import os
from pathlib import Path
import subprocess
import tempfile

GUARD = Path(__file__).resolve().parents[1] / "terraform/terraform-backend/deployment_identity.tf"
MAIN = "cs361-g06-building-data-v3-test"
SANDBOX = MAIN + "-sandbox"
CASES = {
    "default": [(MAIN, "dev", True), (SANDBOX, "dev", False), (SANDBOX, "sandbox", False), ("other-bucket", "dev", False)],
    "sandbox": [(SANDBOX, "sandbox", True), (MAIN, "dev", False), (SANDBOX, "dev", False)],
    "unreviewed": [(MAIN, "dev", False)],
}


def main():
    with tempfile.TemporaryDirectory(prefix="svg-deployment-identity-") as directory:
        fixture = Path(directory)
        (fixture / "deployment_identity.tf").write_text(GUARD.read_text(encoding="utf-8"), encoding="utf-8")
        (fixture / "variables.tf").write_text('variable "bucket_name" { type = string }\nvariable "environment" { type = string }\n', encoding="utf-8")
        tests = fixture / "tests"
        tests.mkdir()
        # Credentials are unnecessary. Clear inherited Terraform options that
        # could redirect this isolated test to the application's backend.
        env = {k: v for k, v in os.environ.items() if not k.startswith("TF_")}
        subprocess.run(["terraform", "init", "-backend=false", "-input=false", "-no-color"], cwd=fixture, env=env, check=True)
        total = 0
        for workspace, cases in CASES.items():
            blocks = []
            for index, (bucket, environment, allowed) in enumerate(cases):
                expected = "" if allowed else "  expect_failures = [terraform_data.deployment_identity]\n"
                blocks.append(
                    f'run "case_{index}" {{\n  command = plan\n  variables {{\n'
                    f'    bucket_name = {json.dumps(bucket)}\n    environment = {json.dumps(environment)}\n'
                    f'  }}\n{expected}}}\n'
                )
            (tests / "identity.tftest.hcl").write_text("\n".join(blocks), encoding="utf-8")
            print(f"Testing workspace: {workspace}", flush=True)
            subprocess.run(["terraform", "test", "-no-color"], cwd=fixture, env={**env, "TF_WORKSPACE": workspace}, check=True)
            total += len(cases)
        print(f"Passed {total} deployment identity cases; no AWS provider or apply was used.")


if __name__ == "__main__":
    main()

"""Offline safety regressions for the main-based manual workflow."""
import hashlib
from pathlib import Path
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/backend-dry-run.yml"


def test_manual_trigger_and_trusted_ref_only():
    workflow = WORKFLOW.read_text()
    triggers = re.search(r"(?m)^on:\n((?:[ \t]+[^\n]*\n)+)", workflow).group(1)
    assert triggers.strip() == "workflow_dispatch:"
    assert "if: ${{ github.ref == 'refs/heads/main' }}" in workflow
    assert "permissions:\n  contents: read" in workflow
    assert "cancel-in-progress: false" in workflow


def test_no_apply_state_repair_upload_or_notifications():
    workflow = WORKFLOW.read_text()
    assert not re.search(r"terraform\s+(apply|destroy|import|refresh|state|force-unlock)\b", workflow)
    assert "-lock=false -detailed-exitcode" in workflow
    assert "TF_WORKSPACE: default" in workflow
    assert "frontend-release" not in workflow and "terraform/terraform-frontend" not in workflow
    assert "smoke_test.py" not in workflow and "post_deployment_verify.py" not in workflow
    assert not re.search(r"aws\s+(s3|cloudfront|sns)\b", workflow)
    assert "continue-on-error" not in workflow


def test_packaging_precedes_credentials_and_guard_follows_plan():
    workflow = WORKFLOW.read_text()
    assert workflow.index("python modules/lambda/build.py") < workflow.index("aws-actions/configure-aws-credentials")
    assert workflow.index("terraform plan ") < workflow.index("deployment_guard.py backend-plan") < workflow.index("Record deployment verification evidence")
    assert "--backend-source backend.tf" in workflow and "terraform workspace show" in workflow


def test_expected_account_is_secret_and_checked_before_credentials():
    workflow = WORKFLOW.read_text()
    assert "DEPLOY_EXPECTED_ACCOUNT_ID: ${{ secrets.EXPECTED_AWS_ACCOUNT_ID }}" in workflow
    assert workflow.index("deployment_guard.py expected-account") < workflow.index("aws-actions/configure-aws-credentials")


def test_original_production_cd_is_unchanged():
    content = (ROOT / ".github/workflows/cd.yml").read_text().encode()
    assert hashlib.sha256(content).hexdigest() == "2815c25a476d57983dac2c9dfc0ce2e0246842713ed8d5f34f358d3510a2e232"


def test_all_guard_runtime_dependencies_are_present():
    for name in ("deployment_guard.py", "sandbox_validation.py"):
        assert (ROOT / "scripts" / name).is_file()
    # Help performs no backend access, package build or AWS request.
    process = subprocess.run([sys.executable, str(ROOT / "scripts/deployment_guard.py"), "--help"], capture_output=True, text=True)
    assert process.returncode == 0 and "backend-plan" in process.stdout

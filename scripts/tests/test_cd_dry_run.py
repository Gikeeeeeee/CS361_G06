"""Regression checks for the explicitly non-deploying CD iteration."""
from pathlib import Path
import os
import re
import shutil
import subprocess

import pytest


ROOT = Path(__file__).resolve().parents[2]


def test_main_cd_has_no_write_or_live_verification_path():
    workflow = (ROOT / ".github/workflows/cd.yml").read_text()
    # Inspect the trigger block independently of event ordering, without adding
    # a YAML dependency to the credential-free CI test environment.
    triggers = re.search(r"(?m)^on:\n((?:[ \t]+[^\n]*\n)+)", workflow).group(1)
    assert set(re.findall(r"(?m)^  ([\w_]+):", triggers)) == {"workflow_dispatch", "push"}
    push = re.search(r"(?m)^  push:\n((?: {4,}[^\n]*\n)+)", triggers).group(1)
    assert [line.strip() for line in push.splitlines()] == ["branches:", "- main"]
    assert "workflow_dispatch:" in workflow and "pull_request:" not in workflow
    assert "TF_WORKSPACE: default" in workflow
    assert not re.search(r"terraform\s+(apply|destroy|import|refresh|state|force-unlock)\b", workflow)
    assert "scripts/smoke_test.py" not in workflow
    assert "terraform/terraform-frontend" not in workflow
    assert "secrets.TF_VARS_FRONTEND" not in workflow
    assert "frontend-boundary" not in workflow
    assert "-lock=false -detailed-exitcode" in workflow
    assert workflow.index("terraform plan ") < workflow.index("deployment_guard.py backend-plan") < workflow.index("Record deployment verification evidence")
    assert "continue-on-error" not in workflow


def test_frontend_stays_in_credential_free_ci():
    workflow = (ROOT / ".github/workflows/ci.yml").read_text()
    assert "frontend_release.py build" in workflow and "frontend_release.py verify" in workflow
    assert "configure-aws-credentials" not in workflow and "secrets." not in workflow
    assert "terraform init -backend=false -input=false -lockfile=readonly" in workflow
    assert "scripts/tests" in workflow
    assert not (ROOT / ".github/workflows/frontend-build.yml").exists()


def step_script(name):
    text = (ROOT / ".github/workflows/cd.yml").read_text()
    step = text.split("- name: " + name + "\n", 1)[1].split("\n      - name:", 1)[0]
    return "\n".join(line[10:] for line in step.split("        run: |\n", 1)[1].splitlines() if line.startswith("          "))


def bash():
    value = str(Path("C:/Program Files/Git/bin/bash.exe")) if os.name == "nt" else shutil.which("bash")
    if not value or not Path(value).exists(): pytest.skip("Bash not installed")
    return value


@pytest.mark.parametrize("status,expected", [(0, 0), (2, 0), (1, 1), (99, 99)])
def test_plan_exit_codes_without_running_terraform(tmp_path, status, expected):
    # Shell function shadows Terraform; no provider, backend or AWS call occurs.
    mock = 'terraform() { test "$*" = "plan -input=false -lock=false -detailed-exitcode -out=tfplan" || return 77; return "$MOCK_PLAN_EXIT"; }\n'
    output = tmp_path / "outputs"
    env = dict(os.environ, MOCK_PLAN_EXIT=str(status), GITHUB_OUTPUT=output.as_posix())
    result = subprocess.run([bash(), "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", mock + step_script("Terraform Plan")],
                            cwd=tmp_path, env=env, capture_output=True, text=True)
    assert result.returncode == expected
    assert output.read_text().strip() == f"exit_code={status}"
    assert not (tmp_path / "tfplan").exists()


def test_summary_and_cleanup_use_only_synthetic_workspace(tmp_path):
    private = tmp_path / "terraform/terraform-backend"
    private.mkdir(parents=True)
    for name in ("tfplan", "terraform.tfvars"): (private / name).write_text("SYNTHETIC_PRIVATE_VALUE")
    summary = tmp_path / "summary.md"
    env = dict(os.environ, GITHUB_WORKSPACE=tmp_path.as_posix(), GITHUB_STEP_SUMMARY=summary.as_posix(),
               GITHUB_SHA="fixture-sha", GITHUB_SERVER_URL="https://github.example.test", GITHUB_REPOSITORY="fixture/repo",
               GITHUB_RUN_ID="1", PLAN_STATUS="success", PLAN_EXIT="2", SAFETY_STATUS="failure")
    for name in ("Record deployment verification evidence", "Remove private dry-run files"):
        result = subprocess.run([bash(), "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", step_script(name)],
                                cwd=tmp_path, env=env, capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
    assert "SYNTHETIC_PRIVATE_VALUE" not in summary.read_text()
    assert "| Plan exit code | 2 |" in summary.read_text()
    assert "Not run: dry-run scope" in summary.read_text()
    assert not list(private.iterdir())

"""Synthetic input diagnostics; never read real plan/state files or contact AWS."""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest

from scripts import deployment_guard as guard
from scripts.tests.test_deployment_guard import existing


def inputs(tmp_path, existing, monkeypatch):
    plan, account, workspace, cached, source = existing
    monkeypatch.setenv("DEPLOY_ACCOUNT_ID", account)
    monkeypatch.setenv("DEPLOY_WORKSPACE", workspace)
    for name, value in (("plan.json", json.dumps(plan)), ("metadata.json", json.dumps(cached)), ("backend.tf", source)):
        (tmp_path / name).write_text(value)
    return ["backend-plan", "--plan", str(tmp_path / "plan.json"),
            "--backend-metadata", str(tmp_path / "metadata.json"), "--backend-source", str(tmp_path / "backend.tf")]


@pytest.mark.parametrize("fault,expected,phase", [
    ("missing_account", "AWS_ACCOUNT_EVIDENCE_MISSING", "account"),
    ("invalid_account", "AWS_ACCOUNT_EVIDENCE_INVALID", "account"),
    ("workspace", "WORKSPACE_MISMATCH", "workspace"),
    ("bucket", "BACKEND_METADATA_MISMATCH", "backend"),
    ("metadata_schema", "BACKEND_METADATA_INVALID", "backend"),
    ("locking", "BACKEND_LOCKING_MISMATCH", "backend"),
    ("backend_source", "BACKEND_CONFIGURATION_UNSUPPORTED", "backend"),
    ("missing_variable", "VARIABLE_EVIDENCE_INVALID", "variables"),
    ("variable", "REGION_OR_VARIABLE_MISMATCH", "variables"),
    ("region", "PRIOR_STATE_REGION_MISMATCH", "variables"),
    ("state_account", "PRIOR_STATE_ACCOUNT_MISMATCH", "account"),
    ("provider", "PROVIDER_CONFIGURATION_MISMATCH", "variables"),
    ("missing_prior_state", "PRIOR_STATE_RESOURCES_MISSING", "prior_state"),
    ("missing_anchor", "PRIOR_STATE_RESOURCES_MISSING", "prior_state"),
    ("missing_identity", "DEPLOYMENT_IDENTITY_EVIDENCE_MISSING", "prior_state"),
    ("invalid_identity", "DEPLOYMENT_IDENTITY_EVIDENCE_INVALID", "prior_state"),
    ("resource_id", "PRIOR_RESOURCE_IDENTITY_INVALID", "prior_state"),
    ("format", "UNEXPECTED_TERRAFORM_JSON_SCHEMA", "plan_validation"),
    ("output_schema", "UNEXPECTED_TERRAFORM_JSON_SCHEMA", "plan_validation"),
    ("output_target", "PLAN_OUTPUT_IDENTITY_MISMATCH", "plan_validation"),
    ("changes_schema", "UNEXPECTED_TERRAFORM_JSON_SCHEMA", "plan_validation"),
    ("missing_changes", "PLAN_RESOURCE_CHANGES_INVALID", "plan_validation"),
    ("duplicate_changes", "DUPLICATE_RESOURCE_CHANGES", "plan_validation"),
    ("coverage", "PRIOR_STATE_PLAN_COVERAGE_MISSING", "prior_state"),
    ("incomplete", "PLAN_INCOMPLETE", "plan_validation"),
    ("errored", "PLAN_ERRORED", "plan_validation"),
    ("deferred", "PLAN_DEFERRED", "plan_validation"),
    ("checks", "PLAN_CHECKS_UNRESOLVED", "plan_validation"),
])
def test_exit_two_has_precise_static_reason(tmp_path, existing, monkeypatch, capsys, fault, expected, phase):
    plan, _, _, cached, _ = existing
    resources = plan["prior_state"]["values"]["root_module"]["resources"]
    if fault == "bucket": cached["backend"]["config"]["bucket"] = "PRIVATE_WRONG_BUCKET"
    if fault == "metadata_schema": cached["backend"] = []
    if fault == "locking": cached["backend"]["config"]["use_lockfile"] = False
    if fault == "missing_variable": plan["variables"].pop("environment")
    if fault == "variable": plan["variables"]["environment"]["value"] = "PRIVATE_ENVIRONMENT"
    if fault == "region": plan["variables"]["aws_region"]["value"] = "PRIVATE_REGION"
    if fault == "state_account": resources[0]["values"]["arn"] = "arn:aws:lambda:fixture-region:111111111111:function:PRIVATE_FUNCTION"
    if fault == "provider": plan["configuration"]["provider_config"]["extra"] = copy.deepcopy(plan["configuration"]["provider_config"]["opaque"])
    if fault == "missing_prior_state": plan.pop("prior_state")
    if fault == "missing_anchor": resources.pop(0)
    if fault == "missing_identity": resources.pop()
    if fault == "invalid_identity": resources[-1]["values"]["input"] = "PRIVATE_IDENTITY"
    if fault == "resource_id": resources[0]["values"].pop("id")
    if fault == "format": plan["format_version"] = []
    if fault == "output_schema": plan["planned_values"] = None
    if fault == "output_target": plan["planned_values"]["outputs"]["api_endpoint"]["value"] = "https://PRIVATE_ENDPOINT.example.test"
    if fault == "changes_schema": plan["resource_changes"][0]["change"] = []
    if fault == "missing_changes": plan.pop("resource_changes")
    if fault == "duplicate_changes": plan["resource_changes"].append(copy.deepcopy(plan["resource_changes"][0]))
    if fault == "coverage": plan["resource_changes"].pop(0)
    if fault == "incomplete": plan["complete"] = False
    if fault == "errored": plan["errored"] = True
    if fault == "deferred": plan["deferred_changes"] = [{"private": "PRIVATE_PAYLOAD"}]
    if fault == "checks": plan["checks"] = [{"status": "unknown", "private": "PRIVATE_PAYLOAD"}]
    args = inputs(tmp_path, existing, monkeypatch)
    if fault == "missing_account": monkeypatch.delenv("DEPLOY_ACCOUNT_ID")
    if fault == "invalid_account": monkeypatch.setenv("DEPLOY_ACCOUNT_ID", "PRIVATE_ACCOUNT")
    if fault == "workspace": monkeypatch.setenv("DEPLOY_WORKSPACE", "PRIVATE_WORKSPACE")
    if fault == "backend_source": (tmp_path / "backend.tf").write_text('backend "local" {}')
    assert guard.main(args) == 2
    output = capsys.readouterr()
    result = json.loads(output.out)
    assert result == {"result": "invalid_or_conflicting_target_evidence", "apply_permitted": False,
                      "reason_code": expected, "phase": phase}
    assert "PRIVATE_" not in output.out + output.err
    assert "arn:" not in output.out + output.err and existing[1] not in output.out
    assert not output.err


@pytest.mark.parametrize("kind", ["plan_syntax", "plan_duplicate", "plan_nonfinite", "plan_nonobject", "missing_plan", "metadata_syntax", "missing_metadata", "missing_source"])
def test_read_and_parse_failures_never_log_raw_inputs(tmp_path, existing, monkeypatch, capsys, kind):
    args = inputs(tmp_path, existing, monkeypatch)
    if kind == "plan_syntax": (tmp_path / "plan.json").write_text('{PRIVATE_PLAN_JSON')
    if kind == "plan_duplicate": (tmp_path / "plan.json").write_text('{"PRIVATE":1,"PRIVATE":2}')
    if kind == "plan_nonfinite": (tmp_path / "plan.json").write_text('{"PRIVATE":NaN}')
    if kind == "plan_nonobject": (tmp_path / "plan.json").write_text('[]')
    if kind == "missing_plan": (tmp_path / "plan.json").unlink()
    if kind == "metadata_syntax": (tmp_path / "metadata.json").write_text('{PRIVATE_METADATA')
    if kind == "missing_metadata": (tmp_path / "metadata.json").unlink()
    if kind == "missing_source": (tmp_path / "backend.tf").unlink()
    assert guard.main(args) == 2
    output = capsys.readouterr().out
    result = json.loads(output)
    expected = "PLAN_JSON_INVALID"
    if kind == "missing_plan": expected = "PLAN_INPUT_UNAVAILABLE"
    if kind == "metadata_syntax": expected = "BACKEND_METADATA_JSON_INVALID"
    if kind == "missing_metadata": expected = "BACKEND_METADATA_UNAVAILABLE"
    if kind == "missing_source": expected = "BACKEND_SOURCE_UNAVAILABLE"
    assert result["reason_code"] == expected
    assert "PRIVATE" not in output and str(tmp_path) not in output


@pytest.mark.parametrize("error,expected", [(KeyError("PRIVATE_KEY"), "UNEXPECTED_TERRAFORM_JSON_SCHEMA"),
    (TypeError("PRIVATE_TYPE"), "UNEXPECTED_TERRAFORM_JSON_SCHEMA"),
    (RuntimeError("PRIVATE_ERROR arn:PRIVATE_VALUE"), "PLAN_VALIDATION_ERROR")])
def test_unexpected_exceptions_are_fail_closed_and_sanitized(tmp_path, existing, monkeypatch, capsys, error, expected):
    args = inputs(tmp_path, existing, monkeypatch)
    def reject(*args): raise error
    monkeypatch.setattr(guard, "inspect_plan", reject)
    assert guard.main(args) == 2
    output = capsys.readouterr().out
    assert json.loads(output)["reason_code"] == expected
    assert "PRIVATE" not in output and "arn:" not in output


def test_blocked_and_passed_evidence_contain_no_resource_identifiers(tmp_path, existing, monkeypatch, capsys):
    args = inputs(tmp_path, existing, monkeypatch)
    assert guard.main(args) == 0
    assert json.loads(capsys.readouterr().out)["reason_code"] == "PLAN_INSPECTION_PASSED"
    existing[0]["resource_changes"][0]["change"]["actions"] = ["delete"]
    args = inputs(tmp_path, existing, monkeypatch)
    assert guard.main(args) == 1
    output = capsys.readouterr().out
    parsed = json.loads(output)
    assert parsed["reason_code"] == "PLAN_CHANGES_BLOCKED" and parsed["failure_count"] == 1
    for identifier in (guard.ANCHORS[0], "address", "arn:", existing[1], "PRIVATE_ENV"):
        assert identifier not in output


def test_stdin_and_actual_process_keep_exit_two_failure(tmp_path, existing, monkeypatch):
    args = inputs(tmp_path, existing, monkeypatch)
    monkeypatch.setenv("DEPLOY_ACCOUNT_ID", "PRIVATE_ACCOUNT")
    args[args.index("--plan") + 1] = "-"
    result = subprocess.run([sys.executable, str(Path(guard.__file__)), *args], input=json.dumps(existing[0]),
                            env=os.environ.copy(), capture_output=True, text=True)
    assert result.returncode == 2
    assert json.loads(result.stdout)["reason_code"] == "AWS_ACCOUNT_EVIDENCE_INVALID"
    assert "PRIVATE_ACCOUNT" not in result.stdout + result.stderr

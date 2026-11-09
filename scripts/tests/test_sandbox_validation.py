"""Sandbox gate fixtures are synthetic; no AWS, state or remote plan calls."""
import copy
import json
from pathlib import Path
import socket
import subprocess
import sys

import pytest

from scripts import sandbox_validation as gate


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("Network access is forbidden")
    monkeypatch.setattr(socket, "create_connection", forbidden)


@pytest.fixture
def evidence():
    expected = {"workspace": "sandbox", "account_id": "000000000000", "region": "fixture-region",
                "terraform_version": "1.15.8", "backend": {"type": "s3", "bucket": "fixture-state-bucket",
                "key": "fixture/state", "region": "fixture-region", "workspace_key_prefix": "env:", "use_lockfile": True},
                "variables": {"aws_region": "fixture-region", "bucket_name": "fixture-assets", "environment": "sandbox"}}
    observed = {"workspace": "sandbox", "caller_account_id": expected["account_id"],
                "terraform_version": expected["terraform_version"], "validation_passed": True,
                "backend": copy.deepcopy(expected["backend"]), "effective_state_key": "env:/sandbox/fixture/state"}
    prior = {"address": "module.fixture.aws_lambda_function.fixture", "mode": "managed",
             "provider_name": "registry.terraform.io/hashicorp/aws",
             "values": {"arn": "arn:aws:lambda:fixture-region:000000000000:function:fixture"}}
    plan = {"format_version": "1.2", "terraform_version": expected["terraform_version"],
            "errored": False, "complete": True, "applyable": False, "variables": {k: {"value": v} for k, v in expected["variables"].items()},
            "configuration": {"provider_config": {"aws": {"full_name": "registry.terraform.io/hashicorp/aws",
                               "expressions": {"region": {"references": ["var.aws_region"]}}}}},
            "prior_state": {"values": {"root_module": {"resources": [prior]}}}, "resource_changes": []}
    return expected, observed, plan


def resource(actions, kind="aws_lambda_function", address="module.fixture.aws_lambda_function.fixture"):
    item = {"address": address, "type": kind, "mode": "managed", "change": {
        "actions": actions, "before": {"source_code_hash": "old", "environment": [{"variables": {"SECRET": "private-before"}}]},
        "after": {"source_code_hash": "new", "environment": [{"variables": {"SECRET": "private-after"}}]},
        "after_unknown": {}}}
    if actions == ["no-op"]: item["change"]["after"] = copy.deepcopy(item["change"]["before"])
    return item


def test_correct_workspace_empty_changes(evidence):
    result, code = gate.inspect(*evidence)
    assert code == 0 and result["result"] == "offline_checks_passed"
    assert result["deployment_authorized"] is False and result["live_identity_verified"] is False


def test_explicit_noop(evidence):
    evidence[2]["resource_changes"] = [resource(["no-op"])]
    result, code = gate.inspect(*evidence)
    assert code == 0 and not result["findings"]


@pytest.mark.parametrize("fault", ["workspace", "expected_workspace", "account", "backend", "key", "prefix", "lock", "effective_key", "version", "validation", "variable", "state_account", "state_region", "empty_state"])
def test_identity_or_backend_mismatch(evidence, fault):
    expected, observed, plan = evidence
    if fault == "workspace": observed["workspace"] = "default"
    if fault == "expected_workspace": expected["workspace"] = "default"
    if fault == "account": observed["caller_account_id"] = "111111111111"
    if fault == "backend": observed["backend"]["bucket"] = "wrong-state"
    if fault == "key": observed["backend"]["key"] = "wrong/key"
    if fault == "prefix": observed["backend"]["workspace_key_prefix"] = "wrong-prefix"
    if fault == "lock": observed["backend"]["use_lockfile"] = False
    if fault == "effective_key": observed["effective_state_key"] = "fixture/state"
    if fault == "version": observed["terraform_version"] = "0.1.0"
    if fault == "validation": observed["validation_passed"] = False
    if fault == "variable": plan["variables"]["environment"]["value"] = "dev"
    prior = plan["prior_state"]["values"]["root_module"]["resources"]
    if fault == "state_account": prior[0]["values"]["arn"] = "arn:aws:lambda:fixture-region:111111111111:function:fixture"
    if fault == "state_region": prior[0]["values"]["arn"] = "arn:aws:lambda:wrong-region:000000000000:function:fixture"
    if fault == "empty_state": prior.clear()
    with pytest.raises(gate.InvalidEvidence): gate.inspect(*evidence)


@pytest.mark.parametrize("actions", [["delete"], ["delete", "create"], ["create", "delete"], ["create"], ["update"], ["read"], ["forget"]])
def test_all_unreviewed_actions_fail_closed(evidence, actions):
    evidence[2]["resource_changes"] = [resource(actions)]
    result, code = gate.inspect(*evidence)
    assert code == 1 and result["result"] == "review_required"
    assert result["findings"][0]["actions"] == actions
    assert ("destructive" in result["findings"][0]["flags"]) == ("delete" in actions)


def test_local_build_helper_replacement_is_not_suppressed(evidence):
    evidence[2]["resource_changes"] = [resource(["delete", "create"], "terraform_data", "module.lambda.terraform_data.build")]
    result, code = gate.inspect(*evidence)
    assert code == 1 and "replacement" in result["findings"][0]["flags"]


def test_lambda_code_environment_and_deferred_hash_flagged(evidence):
    item = resource(["update"])
    item["change"]["after_unknown"] = {"source_code_hash": True}
    evidence[2]["resource_changes"] = [item]
    result, code = gate.inspect(*evidence)
    assert code == 1
    assert {"lambda_review", "lambda_code_or_runtime", "lambda_environment"} <= set(result["findings"][0]["flags"])


def test_six_known_async_deletions_remain_blockers(evidence):
    evidence[2]["resource_changes"] = [resource(["delete"], address=address) for address in gate.ASYNC_RESOURCES]
    result, code = gate.inspect(*evidence)
    assert code == 1 and result["known_async_blockers_in_plan"] == 6


@pytest.mark.parametrize("fault", ["missing_format", "bad_format", "errored", "partial", "deferred", "missing_changes", "unknown_action", "duplicate_address", "unknown_check"])
def test_ambiguous_plan_rejected(evidence, fault):
    plan = evidence[2]
    if fault == "missing_format": plan.pop("format_version")
    if fault == "bad_format": plan["format_version"] = "2.0"
    if fault == "errored": plan["errored"] = True
    if fault == "partial": plan["complete"] = False
    if fault == "deferred": plan["deferred_changes"] = [{"reason": "unknown"}]
    if fault == "missing_changes": plan.pop("resource_changes")
    if fault == "unknown_action": plan["resource_changes"] = [resource(["execute-secret"])]
    if fault == "duplicate_address": plan["resource_changes"] = [resource(["update"])] * 2
    if fault == "unknown_check": plan["checks"] = [{"status": "unknown"}]
    with pytest.raises(gate.InvalidEvidence): gate.inspect(*evidence)


@pytest.mark.parametrize("field", ["resource_drift", "output_changes", "import", "move"])
def test_no_aws_deletes_does_not_imply_safe(evidence, field):
    plan = evidence[2]
    if field == "resource_drift": plan[field] = [{"change": {"actions": ["update"]}}]
    if field == "output_changes": plan[field] = {"sensitive-name": {"actions": ["update"], "after": "secret"}}
    if field in ("import", "move"):
        item = resource(["no-op"])
        if field == "import": item["change"]["importing"] = {"id": "secret"}
        if field == "move": item["previous_address"] = "secret"
        plan["resource_changes"] = [item]
    assert gate.inspect(*evidence)[1] == 1


def write_inputs(tmp_path, evidence):
    evidence = copy.deepcopy(evidence)
    evidence[1]["plan_sha256"] = gate.sha(json.dumps(evidence[2]).encode())
    args = ["inspect"]
    for key, data in zip(("expected", "observed", "plan"), evidence):
        path = tmp_path / (key + ".json")
        path.write_text(json.dumps(data), encoding="utf-8")
        args.extend(["--" + key, str(path)])
    return args


def test_plan_hash_mismatch_rejected(tmp_path, evidence, capsys):
    args = write_inputs(tmp_path, evidence)
    with (tmp_path / "plan.json").open("a") as plan: plan.write(" ")
    assert gate.main(args) == 2
    assert json.loads(capsys.readouterr().out)["result"] == "invalid_or_unavailable_evidence"


def test_inconsistent_noop_rejected(evidence):
    item = resource(["no-op"])
    item["change"]["after"]["source_code_hash"] = "unexpected"
    evidence[2]["resource_changes"] = [item]
    with pytest.raises(gate.InvalidEvidence): gate.inspect(*evidence)


def test_provider_region_not_using_expected_variable_rejected(evidence):
    evidence[2]["configuration"]["provider_config"]["aws"]["expressions"]["region"] = {"constant_value": "wrong-region"}
    with pytest.raises(gate.InvalidEvidence): gate.inspect(*evidence)


def test_provider_keys_are_opaque(evidence):
    providers = evidence[2]["configuration"]["provider_config"]
    providers["opaque-ref"] = providers.pop("aws")
    assert gate.inspect(*evidence)[1] == 0


def test_multiple_provider_accounts_are_ambiguous(evidence):
    providers = evidence[2]["configuration"]["provider_config"]
    providers["another"] = copy.deepcopy(providers["aws"])
    with pytest.raises(gate.InvalidEvidence): gate.inspect(*evidence)


def test_global_aws_managed_policy_reference(evidence):
    prior = evidence[2]["prior_state"]["values"]["root_module"]["resources"][0]
    prior["values"]["policy_arn"] = "arn:aws:iam::aws:policy/service-role/FixtureManagedPolicy"
    assert gate.inspect(*evidence)[1] == 0


@pytest.mark.parametrize("field", ["action_invocations", "deferred_action_invocations"])
def test_provider_actions_cannot_hide_in_noop(evidence, field):
    evidence[2][field] = [{"address": "private-action", "config_values": {"secret": "private"}}]
    with pytest.raises(gate.InvalidEvidence): gate.inspect(*evidence)


def test_applyable_without_explained_actions_is_ambiguous(evidence):
    evidence[2]["applyable"] = True
    with pytest.raises(gate.InvalidEvidence): gate.inspect(*evidence)


@pytest.mark.parametrize("code", [0, 1, 2])
def test_cli_exit_codes_and_redaction(tmp_path, evidence, capsys, code):
    if code == 1:
        evidence[2]["resource_changes"] = [resource(["delete"], address='module.fixture["private-id"]')]
    if code == 2: evidence[1]["workspace"] = "private-wrong-workspace"
    args = write_inputs(tmp_path, evidence)
    assert gate.main(args) == code
    text = capsys.readouterr().out
    data = json.loads(text)
    assert not data["deployment_authorized"]
    for value in ("000000000000", "fixture-state-bucket", "private-id", "private-before", "private-after", "private-wrong-workspace", "arn:aws"):
        assert value not in text


@pytest.mark.parametrize("contents", ["", "null", "[]", "{bad-json private-token}", '{"x":NaN}', '{"x":1,"x":2}'])
def test_invalid_json_sanitized(tmp_path, evidence, capsys, contents):
    args = write_inputs(tmp_path, evidence)
    (tmp_path / "plan.json").write_text(contents)
    assert gate.main(args) == 2
    assert "private-token" not in capsys.readouterr().out


def test_missing_files_and_bad_arguments(capsys):
    assert gate.main(["inspect", "--expected", "missing-private-path"]) == 2
    assert "missing-private-path" not in capsys.readouterr().out


@pytest.mark.parametrize("failed", [False, True])
def test_local_only_runs_fmt_validate(tmp_path, monkeypatch, failed):
    calls = []
    def run(command, env, **kwargs):
        calls.append(command)
        assert not any(key.startswith("TF_CLI_ARGS") or key == "AWS_ACCESS_KEY_ID" for key in env)
        assert env["AWS_EC2_METADATA_DISABLED"] == "true"
        return subprocess.CompletedProcess(command, int(failed), json.dumps({"valid": not failed, "warning_count": 14}), "private diagnostics")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "private")
    monkeypatch.setenv("TF_CLI_ARGS", "-destroy")
    monkeypatch.setattr(gate.subprocess, "run", run)
    data, code = gate.local_checks(tmp_path, tmp_path)
    assert code == int(failed) and len(calls) == 2
    assert [command[2] for command in calls] == ["fmt", "validate"]
    assert "private" not in json.dumps(data)


def test_actual_process_exit_invalid_evidence(tmp_path):
    process = subprocess.run([sys.executable, str(Path(gate.__file__)), "inspect"], capture_output=True, text=True)
    assert process.returncode == 2
    assert json.loads(process.stdout)["result"] == "invalid_or_unavailable_evidence"

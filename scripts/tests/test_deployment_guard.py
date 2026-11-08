"""Existing deployment boundaries, using only synthetic metadata and plans."""
import copy
import json
from pathlib import Path
import subprocess
import sys

import pytest

from scripts import deployment_guard as guard


@pytest.fixture
def existing():
    account, workspace = "000000000000", "default"
    source = '''terraform {
  backend "s3" {
    bucket = "fixture-state"
    key = "fixture/state"
    region = "fixture-state-region"
    use_lockfile = true
  }
}'''
    cached = {"backend": {"type": "s3", "config": {"bucket": "fixture-state", "key": "fixture/state",
              "region": "fixture-state-region", "use_lockfile": True, "secret": "PRIVATE_CACHE_VALUE"}}}
    prior, changes = [], []
    for index, address in enumerate(guard.ANCHORS):
        values = {"id": f"fixture-{index}", "arn": f"arn:aws:lambda:fixture-region:{account}:function:fixture-{index}"}
        kind = address.split(".")[-2]
        if kind == "aws_lambda_function":
            values.update(function_name=f"fixture-{index}", source_code_hash="old", environment=[{"variables": {"KEY": "PRIVATE_ENV"}}])
        if kind == "aws_apigatewayv2_api": values["api_endpoint"] = "https://api.example.test"
        if kind == "aws_cloudfront_distribution": values["domain_name"] = "cdn.example.test"
        resource = {"address": address, "type": kind, "mode": "managed", "provider_name": "registry.terraform.io/hashicorp/aws", "values": values}
        prior.append(resource)
        changes.append({k: resource[k] for k in ("address", "type", "mode")})
        changes[-1]["change"] = {"actions": ["no-op"], "before": copy.deepcopy(values), "after": copy.deepcopy(values), "after_unknown": {}}
    values = {"id": "fixture-identity", "input": {"workspace": workspace, "bucket_name": "fixture-assets", "environment": "fixture-environment"}}
    prior.append({"address": "terraform_data.deployment_identity", "mode": "managed", "type": "terraform_data", "values": values})
    changes.append({"address": "terraform_data.deployment_identity", "type": "terraform_data", "mode": "managed",
                    "change": {"actions": ["no-op"], "before": values, "after": copy.deepcopy(values)}})
    plan = {"format_version": "1.2", "complete": True, "errored": False,
            "variables": {k: {"value": v} for k, v in {"aws_region": "fixture-region", "bucket_name": "fixture-assets", "environment": "fixture-environment"}.items()},
            "configuration": {"provider_config": {"opaque": {"full_name": "registry.terraform.io/hashicorp/aws", "expressions": {"region": {"references": ["var.aws_region"]}}}}},
            "prior_state": {"values": {"root_module": {"resources": prior}}}, "resource_changes": changes,
            "planned_values": {"outputs": {"api_endpoint": {"value": "https://api.example.test"}, "cdn_url": {"value": "https://cdn.example.test"}}}}
    return plan, account, workspace, cached, source


def test_existing_noop_bound_to_state(existing):
    result, code = guard.inspect_plan(*existing)
    assert code == 0 and result["result"] == "existing_backend_plan_checked"
    assert result["frontend_verified"] is False


def test_existing_lambda_code_update_not_recreation(existing):
    change = existing[0]["resource_changes"][0]["change"]
    change["actions"] = ["update"]
    change["after"]["source_code_hash"] = None
    change["after_unknown"] = {"source_code_hash": True}
    assert guard.inspect_plan(*existing)[1] == 0


@pytest.mark.parametrize("actions", [["create"], ["delete"], ["delete", "create"], ["create", "delete"], ["forget"], ["invoke"]])
def test_no_resource_create_delete_or_replace(existing, actions):
    existing[0]["resource_changes"][0]["change"]["actions"] = actions
    result, code = guard.inspect_plan(*existing)
    assert code == 1
    assert result["failures"][0]["address"] == guard.ANCHORS[0]


def test_local_build_replacement_is_not_exempt(existing):
    address = "module.lambda.terraform_data.build"
    existing[0]["resource_changes"].append({"address": address, "type": "terraform_data", "mode": "managed",
        "change": {"actions": ["delete", "create"], "before": {"id": "old"}, "after": {"id": None}}})
    result, code = guard.inspect_plan(*existing)
    assert code == 1 and result["failures"][-1]["address"] == address


def test_six_known_deletions_are_reported_not_suppressed(existing):
    for address in guard.ASYNC_RESOURCES:
        existing[0]["resource_changes"].append({"address": address, "type": "aws_fixture", "mode": "managed",
            "change": {"actions": ["delete"], "before": {"id": "fixture"}, "after": None}})
    result, code = guard.inspect_plan(*existing)
    assert code == 1
    assert {finding["address"] for finding in result["failures"]} == set(guard.ASYNC_RESOURCES)


@pytest.mark.parametrize("fault", ["account", "workspace", "region", "bucket", "key", "lock", "empty_state", "missing_anchor", "provider", "endpoint", "cdn", "partial", "deferred"])
def test_invalid_or_conflicting_identity_fails_closed(existing, fault):
    values = list(existing)
    plan = values[0]
    if fault == "account": values[1] = "111111111111"
    if fault == "workspace": values[2] = "sandbox"
    if fault == "region": plan["variables"]["aws_region"]["value"] = "wrong-region"
    if fault in ("bucket", "key"): values[3]["backend"]["config"][fault] = "wrong"
    if fault == "lock": values[3]["backend"]["config"]["use_lockfile"] = False
    if fault == "empty_state": plan["prior_state"]["values"]["root_module"]["resources"] = []
    if fault == "missing_anchor": plan["resource_changes"].pop(0)
    if fault == "provider": plan["configuration"]["provider_config"]["opaque"]["expressions"]["region"] = {"constant_value": "guessed"}
    if fault == "endpoint": plan["planned_values"]["outputs"]["api_endpoint"]["value"] = "https://guessed.example.test"
    if fault == "cdn": plan["planned_values"]["outputs"]["cdn_url"]["value"] = "https://guessed.example.test"
    if fault == "partial": plan["complete"] = False
    if fault == "deferred": plan["action_invocations"] = [{"secret": "PRIVATE"}]
    with pytest.raises((ValueError, KeyError)): guard.inspect_plan(*values)


@pytest.mark.parametrize("key", ["id", "arn", "function_name", "environment"])
def test_inplace_cannot_retarget_or_change_auth(existing, key):
    change = existing[0]["resource_changes"][0]["change"]
    change["actions"] = ["update"]
    change["after"][key] = "different"
    assert guard.inspect_plan(*existing)[1] == 1


def test_non_anchor_private_address_redacted(existing):
    address = 'module.example.aws_s3_object.this["PRIVATE_OBJECT"]'
    existing[0]["resource_changes"].append({"address": address, "mode": "managed", "type": "aws_s3_object", "change": {"actions": ["create"]}})
    result, code = guard.inspect_plan(*existing)
    assert code == 1 and "PRIVATE_OBJECT" not in json.dumps(result)


@pytest.mark.parametrize("guessed", ["", "guessed-bucket", "conflicting-target"])
def test_frontend_boundary_cannot_be_enabled_by_guessed_configuration(monkeypatch, guessed):
    monkeypatch.setenv("FRONTEND_BUCKET", guessed)
    monkeypatch.setenv("FRONTEND_DISTRIBUTION_ID", guessed)
    data, code = guard.frontend_boundary()
    assert code == 1 and data["frontend_verified"] is False
    assert data["backend_write_authorized"] is False


def test_frontend_cli_has_no_aws_or_write_path():
    result = subprocess.run([sys.executable, str(Path(guard.__file__)), "frontend-boundary"], capture_output=True, text=True)
    assert result.returncode == 1
    assert json.loads(result.stdout)["reason"] == "frontend_authoritative_state_and_live_ownership_unverified"


def test_missing_evidence_exit_code_redacted(capsys):
    assert guard.main(["backend-plan", "--plan", "PRIVATE_PATH"]) == 2
    assert "PRIVATE_PATH" not in capsys.readouterr().out


def test_backend_cli_stdin_no_secrets_in_output(existing, tmp_path, monkeypatch, capsys):
    import io
    plan, account, workspace, cached, source = existing
    metadata, backend = tmp_path / "metadata.json", tmp_path / "backend.tf"
    metadata.write_text(json.dumps(cached))
    backend.write_text(source)
    monkeypatch.setenv("DEPLOY_ACCOUNT_ID", account)
    monkeypatch.setenv("DEPLOY_WORKSPACE", workspace)
    monkeypatch.setattr(sys, "stdin", io.StringIO(json.dumps(plan)))
    assert guard.main(["backend-plan", "--plan", "-", "--backend-metadata", str(metadata), "--backend-source", str(backend)]) == 0
    output = capsys.readouterr().out
    assert all(value not in output for value in (account, "PRIVATE_CACHE_VALUE", "PRIVATE_ENV", "fixture-state"))

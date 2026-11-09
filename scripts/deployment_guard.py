"""Existing-resource CD checks. No AWS calls or deployment commands."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys

if __package__:
    from .sandbox_validation import ASYNC_RESOURCES, InvalidEvidence, children, decode, unknown
else:
    from sandbox_validation import ASYNC_RESOURCES, InvalidEvidence, children, decode, unknown


class EvidenceError(InvalidEvidence):
    """Static diagnostic codes only: never attach input values or exceptions."""
    def __init__(self, reason_code, phase):
        self.reason_code = reason_code
        self.phase = phase
        super().__init__("Deployment evidence rejected; values suppressed")


def require(condition, reason_code="UNEXPECTED_TERRAFORM_JSON_SCHEMA", phase="plan_validation"):
    if not condition:
        raise EvidenceError(reason_code, phase)


def mapping(value, reason_code="UNEXPECTED_TERRAFORM_JSON_SCHEMA", phase="plan_validation"):
    require(isinstance(value, dict), reason_code, phase)
    return value


ANCHORS = (
    "module.lambda.aws_lambda_function.this",
    "module.lambda.aws_lambda_function.indexer",
    "module.api_gateway.aws_apigatewayv2_api.this",
    "module.storage.aws_s3_bucket.this",
    "module.storage.aws_cloudfront_distribution.assets",
    "module.dynamodb.aws_dynamodb_table.this",
    "module.opensearch.aws_opensearchserverless_collection.this",
)
IDENTITY_KEYS = ("id", "arn", "function_name", "bucket", "key", "api_id", "name",
                 "role", "policy_arn", "event_source_arn", "origin", "route_key",
                 "domain_name", "api_endpoint", "execution_arn", "handler", "runtime", "architectures", "layers")


def local_build_replacement(resource, prior):
    """Recognize only the existing local Lambda packaging helper, not AWS resources."""
    address = resource["address"]
    change = resource["change"]
    if (address != "module.lambda.terraform_data.build" or resource.get("type") != "terraform_data"
            or resource.get("mode") != "managed" or address not in prior
            or prior[address].get("provider_name") != "terraform.io/builtin/terraform"
            or resource.get("provider_name") != "terraform.io/builtin/terraform"
            or change.get("actions") != ["delete", "create"]
            or resource.get("previous_address") or change.get("importing")):
        return False
    before, after = change.get("before"), change.get("after")
    if not isinstance(before, dict) or not isinstance(after, dict) or before != prior[address]["values"]:
        return False
    uncertain = change.get("after_unknown") or {}
    hashes = lambda value: isinstance(value, list) and bool(value) and all(
        isinstance(v, str) and re.fullmatch(r"[0-9a-f]{64}", v) for v in value)
    return (isinstance(before.get("id"), str) and bool(before["id"])
            and before.get("input") is None and after.get("input") is None
            and before.get("output") is None and after.get("output") is None and after.get("id") is None
            and hashes(before.get("triggers_replace")) and hashes(after.get("triggers_replace"))
            and before["triggers_replace"] != after["triggers_replace"]
            and uncertain.get("id") is True and not unknown(uncertain.get("triggers_replace"))
            and not unknown(uncertain.get("input"))
            and set(after) <= {"id", "input", "output", "triggers_replace"})


def backend_identity(plan, workspace, cached_backend, backend_source):
    require(workspace == "default", "WORKSPACE_MISMATCH", "workspace")
    require(isinstance(backend_source, str) and re.findall(r'backend\s+"([^"]+)"', backend_source) == ["s3"],
            "BACKEND_CONFIGURATION_UNSUPPORTED", "backend")
    cached_backend = mapping(cached_backend, "BACKEND_METADATA_INVALID", "backend")
    actual = mapping(cached_backend.get("backend"), "BACKEND_METADATA_INVALID", "backend")
    config = mapping(actual.get("config"), "BACKEND_METADATA_INVALID", "backend")
    require(actual.get("type") == "s3", "BACKEND_METADATA_MISMATCH", "backend")
    for key in ("bucket", "key", "region"):
        values = re.findall(r'^\s*' + key + r'\s*=\s*"([^"\n]+)"\s*$', backend_source, re.MULTILINE)
        require(len(values) == 1, "BACKEND_CONFIGURATION_UNSUPPORTED", "backend")
        require(config.get(key) == values[0], "BACKEND_METADATA_MISMATCH", "backend")
    require(re.search(r'^\s*use_lockfile\s*=\s*true\s*$', backend_source, re.MULTILINE)
            and config.get("use_lockfile") is True, "BACKEND_LOCKING_MISMATCH", "backend")
    variables = mapping(plan.get("variables"), "VARIABLE_EVIDENCE_INVALID", "variables")
    values = {}
    for key in ("aws_region", "bucket_name", "environment"):
        value = mapping(variables.get(key), "VARIABLE_EVIDENCE_INVALID", "variables").get("value")
        require(isinstance(value, str) and bool(value), "VARIABLE_EVIDENCE_INVALID", "variables")
        values[key] = value
    configuration = mapping(plan.get("configuration"))
    provider_map = mapping(configuration.get("provider_config"))
    require(all(isinstance(p, dict) for p in provider_map.values()))
    providers = [p for p in provider_map.values() if p.get("full_name") == "registry.terraform.io/hashicorp/aws"]
    require(len(providers) == 1 and not providers[0].get("alias") and not providers[0].get("module_address"),
            "PROVIDER_CONFIGURATION_MISMATCH", "variables")
    expression = mapping(mapping(providers[0].get("expressions")).get("region"))
    require(expression.get("references") == ["var.aws_region"], "REGION_OR_VARIABLE_MISMATCH", "variables")
    state = mapping(plan.get("prior_state"), "PRIOR_STATE_RESOURCES_MISSING", "prior_state")
    state_values = mapping(state.get("values"), "PRIOR_STATE_RESOURCES_MISSING", "prior_state")
    module = mapping(state_values.get("root_module"), "PRIOR_STATE_RESOURCES_MISSING", "prior_state")
    try:
        resources = list(children(module))
    except InvalidEvidence:
        raise EvidenceError("UNEXPECTED_TERRAFORM_JSON_SCHEMA", "prior_state") from None
    require(all(isinstance(r, dict) and isinstance(r.get("address"), str) for r in resources),
            "UNEXPECTED_TERRAFORM_JSON_SCHEMA", "prior_state")
    prior = {r["address"]: r for r in resources}
    require(len(prior) == len(resources), "UNEXPECTED_TERRAFORM_JSON_SCHEMA", "prior_state")
    require(all(address in prior for address in ANCHORS), "PRIOR_STATE_RESOURCES_MISSING", "prior_state")
    # Production ownership comes from real resource identities, not an optional
    # local Terraform bookkeeping object that older state may never contain.
    bucket = mapping(prior[ANCHORS[3]].get("values"), "PRIOR_RESOURCE_IDENTITY_INVALID", "prior_state")
    require(bucket.get("id") == values["bucket_name"] and bucket.get("bucket") == values["bucket_name"],
            "REGION_OR_VARIABLE_MISMATCH", "variables")
    tags = bucket.get("tags") or {}
    require(isinstance(tags, dict))
    if "Environment" in tags:
        require(tags["Environment"] == values["environment"], "REGION_OR_VARIABLE_MISMATCH", "variables")
    for resource in prior.values():
        if resource.get("mode") != "managed" or resource.get("provider_name") != "registry.terraform.io/hashicorp/aws":
            continue
        resource_values = mapping(resource.get("values"), "PRIOR_RESOURCE_IDENTITY_INVALID", "prior_state")
        require(isinstance(resource_values.get("id"), str) and bool(resource_values["id"]),
                "PRIOR_RESOURCE_IDENTITY_INVALID", "prior_state")
    return prior


def inspect_plan(plan, workspace, cached_backend, backend_source):
    mapping(plan)
    require(isinstance(plan.get("format_version"), str) and re.fullmatch(r"1\.\d+", plan["format_version"]))
    require(type(plan.get("complete")) is bool and type(plan.get("errored")) is bool)
    require(plan["errored"] is False, "PLAN_ERRORED", "plan_validation")
    require(plan["complete"] is True, "PLAN_INCOMPLETE", "plan_validation")
    require(not plan.get("deferred_changes") and not plan.get("action_invocations") and not plan.get("deferred_action_invocations"),
            "PLAN_DEFERRED", "plan_validation")
    checks = plan.get("checks", [])
    require(isinstance(checks, list) and all(isinstance(c, dict) for c in checks))
    require(all(c.get("status") == "pass" for c in checks), "PLAN_CHECKS_UNRESOLVED", "plan_validation")
    prior = backend_identity(plan, workspace, cached_backend, backend_source)
    outputs = mapping(mapping(plan.get("planned_values")).get("outputs"))
    api_values = mapping(prior[ANCHORS[2]].get("values"), "PRIOR_RESOURCE_IDENTITY_INVALID", "prior_state")
    cdn_values = mapping(prior[ANCHORS[4]].get("values"), "PRIOR_RESOURCE_IDENTITY_INVALID", "prior_state")
    require(isinstance(api_values.get("api_endpoint"), str) and isinstance(cdn_values.get("domain_name"), str),
            "PRIOR_RESOURCE_IDENTITY_INVALID", "prior_state")
    require(mapping(outputs.get("api_endpoint")).get("value") == api_values["api_endpoint"]
            and mapping(outputs.get("cdn_url")).get("value") == "https://" + cdn_values["domain_name"],
            "PLAN_OUTPUT_IDENTITY_MISMATCH", "plan_validation")
    require(isinstance(plan.get("resource_changes"), list) and bool(plan["resource_changes"]),
            "PLAN_RESOURCE_CHANGES_INVALID", "plan_validation")
    failures, local_helpers, seen = [], [], set()
    for resource in plan["resource_changes"]:
        mapping(resource)
        address, change = resource.get("address"), mapping(resource.get("change"))
        require(isinstance(address, str) and bool(address))
        require(address not in seen, "DUPLICATE_RESOURCE_CHANGES", "plan_validation")
        seen.add(address)
        actions = change.get("actions")
        require(isinstance(actions, list) and all(isinstance(a, str) for a in actions))
        reason = None
        risks = []
        if resource.get("mode") == "data":
            require(actions in (["read"], ["no-op"]))
            continue
        if local_build_replacement(resource, prior):
            local_helpers.append({"address": address, "classification": "existing_local_packaging_helper_only"})
            continue
        if actions not in (["no-op"], ["update"]):
            reason = "create_delete_replace_or_unsupported_action"
        elif address not in prior or change.get("before") != prior[address]["values"]:
            reason = "resource_not_bound_to_existing_state"
        elif resource.get("previous_address") or change.get("importing"):
            reason = "ownership_change"
        elif actions == ["no-op"]:
            if change.get("before") != change.get("after") or unknown(change.get("after_unknown")):
                reason = "inconsistent_noop"
        elif not resource.get("type", "").startswith("aws_"):
            reason = "local_helper_change_requires_review"
        else:
            before, after = change["before"], change["after"]
            uncertain = change.get("after_unknown") or {}
            require(isinstance(after, dict))
            for key in IDENTITY_KEYS:
                if key in before and (before[key] != after.get(key) or unknown(uncertain.get(key))):
                    reason = "existing_resource_identity_changed"
            if resource["type"].startswith("aws_iam_"):
                reason = "iam_change_requires_separate_approval"
            if resource["type"] == "aws_lambda_function" and (
                    before.get("environment") != after.get("environment") or unknown(uncertain.get("environment"))):
                reason = "lambda_environment_change_requires_review"
                risks.append("lambda_environment_change")
            if resource["type"] == "aws_lambda_function" and any(
                    before.get(key) != after.get(key) or unknown(uncertain.get(key))
                    for key in ("source_code_hash", "filename", "s3_bucket", "s3_key", "s3_object_version", "image_uri")):
                # A preserved function ID does not establish code compatibility.
                # In particular, a deferred ZIP hash cannot prove absence of rollback.
                reason = "lambda_artifact_compatibility_unverified"
                risks.append("lambda_artifact_change_or_unknown_hash")
        if reason:
            finding = {"address_sha256": hashlib.sha256(address.encode()).hexdigest(), "reason": reason}
            if risks:
                finding["risks"] = risks
            if address in ASYNC_RESOURCES or address in ANCHORS or address == "module.lambda.terraform_data.build":
                finding["address"] = address  # Known source addresses only, never for_each keys.
            failures.append(finding)
    # A partial/targeted change list cannot establish the existing deployment's identity.
    require(all(address in seen for address in ANCHORS)
            and all(address in seen for address, resource in prior.items() if resource.get("mode") == "managed"),
            "PRIOR_STATE_PLAN_COVERAGE_MISSING", "prior_state")
    if plan.get("resource_drift"):
        failures.append({"reason": "unreviewed_refresh_drift"})
    return {"result": "blocked" if failures else "existing_backend_plan_checked",
            "scope": "backend_dry_run", "apply_permitted": False, "frontend_scope": "out_of_scope",
            "local_build_helper_changes": local_helpers, "failures": failures}, int(bool(failures))


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise EvidenceError("CLI_ARGUMENTS_INVALID", "arguments")


def public_evidence(evidence, code):
    """Allow only static classifications/counts, never identifiers or plan values."""
    return {"result": evidence["result"], "category": "unsafe_resource_changes" if code else "validated_plan",
            "scope": "backend_dry_run", "apply_permitted": False,
            "frontend_scope": "out_of_scope", "reason_code": "PLAN_CHANGES_BLOCKED" if code else "PLAN_INSPECTION_PASSED",
            "phase": "plan_safety", "failure_count": len(evidence["failures"]),
            "failures": [{"reason": f["reason"], "risks": f.get("risks", [])} for f in evidence["failures"]],
            "local_build_helper_changes": [{"classification": "existing_local_packaging_helper_only"}
                                           for _ in evidence["local_build_helper_changes"]]}


def read_json_input(path, phase):
    try:
        text = sys.stdin.read() if path == "-" else Path(path).read_text(encoding="utf-8-sig")
    except (OSError, UnicodeError):
        raise EvidenceError("PLAN_INPUT_UNAVAILABLE" if phase == "plan_parse" else "BACKEND_METADATA_UNAVAILABLE", phase) from None
    try:
        return decode(text)
    except (ValueError, TypeError, RecursionError):
        raise EvidenceError("PLAN_JSON_INVALID" if phase == "plan_parse" else "BACKEND_METADATA_JSON_INVALID", phase) from None


def main(argv=None):
    phase = "arguments"
    try:
        parser = Parser(description=__doc__)
        commands = parser.add_subparsers(dest="command", required=True)
        check = commands.add_parser("backend-plan")
        check.add_argument("--plan", required=True)
        check.add_argument("--backend-metadata", required=True)
        check.add_argument("--backend-source", required=True)
        args = parser.parse_args(argv)
        phase = "plan_parse"
        plan = read_json_input(args.plan, phase)
        phase = "backend"
        cached = read_json_input(args.backend_metadata, phase)
        try:
            source = Path(args.backend_source).read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            raise EvidenceError("BACKEND_SOURCE_UNAVAILABLE", phase) from None
        phase = "plan_validation"
        evidence, code = inspect_plan(
            plan,
            os.environ.get("DEPLOY_WORKSPACE"), cached, source)
        evidence = public_evidence(evidence, code)
    except EvidenceError as error:
        evidence, code = {"result": "invalid_or_conflicting_target_evidence", "apply_permitted": False,
                          "reason_code": error.reason_code, "phase": error.phase}, 2
    except (KeyError, TypeError, AttributeError, InvalidEvidence):
        evidence, code = {"result": "invalid_or_conflicting_target_evidence", "apply_permitted": False,
                          "reason_code": "UNEXPECTED_TERRAFORM_JSON_SCHEMA", "phase": phase}, 2
    except Exception:
        evidence, code = {"result": "invalid_or_conflicting_target_evidence", "apply_permitted": False,
                          "reason_code": "PLAN_VALIDATION_ERROR", "phase": phase}, 2
    if code == 2:
        target_phases = {"workspace", "backend", "variables", "prior_state"}
        evidence["category"] = ("target_identity_validation_failure" if evidence["phase"] in target_phases
                                and evidence["reason_code"] != "PRIOR_STATE_PLAN_COVERAGE_MISSING"
                                else "plan_validation_failure")
    print(json.dumps(evidence, sort_keys=True))
    return code


if __name__ == "__main__":
    raise SystemExit(main())

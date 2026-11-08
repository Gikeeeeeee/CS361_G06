"""Existing-resource CD checks. No AWS calls or deployment commands."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys

if __package__:
    from .sandbox_validation import ASYNC_RESOURCES, arns, children, decode, require, unknown
else:
    from sandbox_validation import ASYNC_RESOURCES, arns, children, decode, require, unknown


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


def frontend_boundary():
    # There is no approved authoritative frontend state/identity in this repository.
    # Do not turn arbitrary environment variables or a new empty state into ownership.
    return {"result": "blocked", "frontend_verified": False, "backend_write_authorized": False,
            "reason": "frontend_authoritative_state_and_live_ownership_unverified"}, 1


def backend_identity(plan, account, workspace, cached_backend, backend_source):
    require(workspace == "default" and re.fullmatch(r"\d{12}", account or ""))
    require(re.findall(r'backend\s+"([^"]+)"', backend_source) == ["s3"])
    actual = cached_backend["backend"]
    require(actual["type"] == "s3")
    for key in ("bucket", "key", "region"):
        values = re.findall(r'^\s*' + key + r'\s*=\s*"([^"\n]+)"\s*$', backend_source, re.MULTILINE)
        require(len(values) == 1 and actual["config"][key] == values[0])
    require(re.search(r'^\s*use_lockfile\s*=\s*true\s*$', backend_source, re.MULTILINE))
    require(actual["config"]["use_lockfile"] is True)
    variables = plan["variables"]
    region = variables["aws_region"]["value"]
    require(isinstance(region, str) and bool(region))
    providers = [p for p in plan["configuration"]["provider_config"].values()
                 if p.get("full_name") == "registry.terraform.io/hashicorp/aws"]
    require(len(providers) == 1 and not providers[0].get("alias") and not providers[0].get("module_address"))
    require(providers[0]["expressions"]["region"].get("references") == ["var.aws_region"])
    prior = {r["address"]: r for r in children(plan["prior_state"]["values"]["root_module"])}
    require(all(address in prior for address in ANCHORS))
    identity = prior["terraform_data.deployment_identity"]["values"]["input"]
    require(identity["workspace"] == workspace)
    require(identity["bucket_name"] == variables["bucket_name"]["value"])
    require(identity["environment"] == variables["environment"]["value"])
    scoped = 0
    for resource in prior.values():
        if resource.get("mode") != "managed" or resource.get("provider_name") != "registry.terraform.io/hashicorp/aws":
            continue
        require(isinstance(resource.get("values", {}).get("id"), str) and bool(resource["values"]["id"]))
        for arn in arns(resource["values"]):
            require(len(arn) == 6)
            if arn[2:5] == ["iam", "", "aws"] and arn[5].startswith("policy/"):
                continue
            require(not arn[4] or arn[4] == account)
            require(not arn[3] or arn[3] == region)
            scoped += bool(arn[4] and arn[3])
    require(scoped > 0)
    return prior


def inspect_plan(plan, account, workspace, cached_backend, backend_source):
    require(re.fullmatch(r"1\.\d+", plan["format_version"]))
    require(plan.get("complete") is True and plan.get("errored") is False)
    require(not plan.get("deferred_changes") and not plan.get("action_invocations") and not plan.get("deferred_action_invocations"))
    require(all(c.get("status") == "pass" for c in plan.get("checks", [])))
    prior = backend_identity(plan, account, workspace, cached_backend, backend_source)
    outputs = plan["planned_values"]["outputs"]
    require(outputs["api_endpoint"]["value"] == prior[ANCHORS[2]]["values"]["api_endpoint"])
    require(outputs["cdn_url"]["value"] == "https://" + prior[ANCHORS[4]]["values"]["domain_name"])
    require(isinstance(plan.get("resource_changes"), list) and bool(plan["resource_changes"]))
    failures, seen = [], set()
    for resource in plan["resource_changes"]:
        address, change = resource["address"], resource["change"]
        require(address not in seen)
        seen.add(address)
        actions = change["actions"]
        reason = None
        if resource.get("mode") == "data":
            require(actions in (["read"], ["no-op"]))
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
        if reason:
            finding = {"address_sha256": hashlib.sha256(address.encode()).hexdigest(), "reason": reason}
            if address in ASYNC_RESOURCES or address in ANCHORS or address == "module.lambda.terraform_data.build":
                finding["address"] = address  # Known source addresses only, never for_each keys.
            failures.append(finding)
    # A partial/targeted change list cannot establish the existing deployment's identity.
    require(all(address in seen for address in ANCHORS))
    require(all(address in seen for address, resource in prior.items() if resource.get("mode") == "managed"))
    if plan.get("resource_drift"):
        failures.append({"reason": "unreviewed_refresh_drift"})
    return {"result": "blocked" if failures else "existing_backend_plan_checked",
            "frontend_verified": False, "failures": failures}, int(bool(failures))


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise ValueError("Invalid arguments")


def main(argv=None):
    try:
        parser = Parser(description=__doc__)
        commands = parser.add_subparsers(dest="command", required=True)
        commands.add_parser("frontend-boundary")
        check = commands.add_parser("backend-plan")
        check.add_argument("--plan", required=True)
        check.add_argument("--backend-metadata", required=True)
        check.add_argument("--backend-source", required=True)
        args = parser.parse_args(argv)
        if args.command == "frontend-boundary":
            evidence, code = frontend_boundary()
        else:
            evidence, code = inspect_plan(
                decode(sys.stdin.read() if args.plan == "-" else Path(args.plan).read_text(encoding="utf-8-sig")),
                os.environ.get("DEPLOY_ACCOUNT_ID"), os.environ.get("DEPLOY_WORKSPACE"),
                decode(Path(args.backend_metadata).read_text(encoding="utf-8-sig")),
                Path(args.backend_source).read_text(encoding="utf-8"))
    except Exception:
        evidence, code = {"result": "invalid_or_conflicting_target_evidence", "frontend_verified": False}, 2
    print(json.dumps(evidence, sort_keys=True))
    return code


if __name__ == "__main__":
    raise SystemExit(main())

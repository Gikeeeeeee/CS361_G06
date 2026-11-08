"""Offline sandbox checks. Never invokes AWS, plan, apply, init or state commands."""
import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


ASYNC_RESOURCES = (
    "module.api_gateway.aws_apigatewayv2_route.get_schedule_import_job",
    "module.lambda.aws_iam_policy.import_jobs",
    "module.lambda.aws_iam_role_policy_attachment.import_jobs",
    "module.lambda.aws_lambda_function.import_worker",
    "module.lambda.aws_lambda_function_event_invoke_config.import_worker",
    "module.storage.aws_s3_bucket_lifecycle_configuration.this",
)
ACTIONS = {("no-op",), ("read",), ("create",), ("update",), ("delete",),
           ("delete", "create"), ("create", "delete"), ("forget",), ("create", "forget")}


class InvalidEvidence(ValueError):
    pass


def require(condition):
    if not condition:
        raise InvalidEvidence("Missing, invalid or mismatched evidence; raw values suppressed")


def decode(text):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result)
            result[key] = value
        return result
    def invalid_constant(_):
        raise InvalidEvidence("Nonfinite JSON")
    value = json.loads(text, object_pairs_hook=pairs, parse_constant=invalid_constant)
    require(isinstance(value, dict))
    return value


def load(path):
    return decode(Path(path).read_text(encoding="utf-8-sig"))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def children(module):
    require(isinstance(module, dict))
    resources = module.get("resources", [])
    require(isinstance(resources, list))
    yield from resources
    modules = module.get("child_modules", [])
    require(isinstance(modules, list))
    for child in modules:
        yield from children(child)


def arns(value):
    if isinstance(value, dict):
        for child in value.values():
            yield from arns(child)
    elif isinstance(value, list):
        for child in value:
            yield from arns(child)
    elif isinstance(value, str) and value.startswith("arn:"):
        yield value.split(":", 5)


def validate_context(expected, observed, plan):
    require(expected["workspace"] == "sandbox" and observed["workspace"] == expected["workspace"])
    require(isinstance(expected["account_id"], str) and re.fullmatch(r"\d{12}", expected["account_id"]))
    require(observed["caller_account_id"] == expected["account_id"])
    require(isinstance(expected["region"], str) and bool(expected["region"]))
    version = expected["terraform_version"]
    require(isinstance(version, str) and re.fullmatch(r"\d+\.\d+\.\d+", version))
    require(tuple(map(int, version.split("."))) >= (1, 10, 0))
    require(observed["terraform_version"] == version == plan["terraform_version"])
    require(observed["validation_passed"] is True)
    backend, actual = expected["backend"], observed["backend"]
    require(backend["type"] == actual["type"] == "s3")
    for key in ("bucket", "key", "region", "workspace_key_prefix"):
        require(isinstance(backend[key], str) and bool(backend[key]) and backend[key] == actual[key])
    require(backend["use_lockfile"] is True and actual["use_lockfile"] is True)
    state_key = f'{backend["workspace_key_prefix"]}/{expected["workspace"]}/{backend["key"]}'
    require(observed["effective_state_key"] == state_key)
    variables = expected["variables"]
    require(isinstance(variables, dict) and {"aws_region", "bucket_name", "environment"} <= variables.keys())
    require(variables["aws_region"] == expected["region"] and variables["environment"] == expected["workspace"])
    require(isinstance(variables["bucket_name"], str) and bool(variables["bucket_name"]))
    for key, value in variables.items():
        require(isinstance(value, str) and bool(value) and plan["variables"][key]["value"] == value)
    # Provider-config keys are opaque in Terraform JSON; do not assume "aws".
    providers = plan["configuration"]["provider_config"]
    require(isinstance(providers, dict))
    aws = [p for p in providers.values() if isinstance(p, dict) and p.get("full_name") == "registry.terraform.io/hashicorp/aws"]
    require(len(aws) == 1)
    provider = aws[0]
    require(not provider.get("alias") and not provider.get("module_address"))
    require(provider["expressions"]["region"].get("references") == ["var.aws_region"])
    # Existing-sandbox only: empty prior state cannot prove ownership or recovery.
    prior = list(children(plan["prior_state"]["values"]["root_module"]))
    require(bool(prior))
    scoped = 0
    for resource in prior:
        require(isinstance(resource, dict))
        if resource.get("mode") != "managed" or resource.get("provider_name") != "registry.terraform.io/hashicorp/aws":
            continue
        for arn in arns(resource.get("values", {})):
            require(len(arn) == 6)
            # AWS-managed IAM policies are global references, not another customer account.
            if arn[2:5] == ["iam", "", "aws"] and arn[5].startswith("policy/"):
                continue
            if arn[4]:
                require(arn[4] == expected["account_id"])
            if arn[3]:
                require(arn[3] == expected["region"])
            if arn[4] and arn[3]:
                scoped += 1
    require(scoped > 0)


def changed(change, key):
    before, after = change.get("before") or {}, change.get("after") or {}
    unknown = change.get("after_unknown") or {}
    return before.get(key) != after.get(key) or bool(unknown.get(key))


def unknown(value):
    if isinstance(value, dict): return any(unknown(v) for v in value.values())
    if isinstance(value, list): return any(unknown(v) for v in value)
    return value is True


def inspect(expected, observed, plan):
    require(isinstance(plan.get("format_version"), str) and re.fullmatch(r"1\.\d+", plan["format_version"]))
    require(plan.get("errored") is False and plan.get("complete") is True)
    require(type(plan.get("applyable")) is bool)
    require(isinstance(plan.get("resource_changes"), list))
    require(not plan.get("deferred_changes") and not plan.get("action_invocations")
            and not plan.get("deferred_action_invocations"))
    validate_context(expected, observed, plan)
    findings, counts, seen = [], Counter(), set()
    for item in plan["resource_changes"]:
        require(isinstance(item, dict) and isinstance(item["address"], str) and item["address"] not in seen)
        seen.add(item["address"])
        change = item["change"]
        require(isinstance(change, dict) and isinstance(change["actions"], list))
        actions = tuple(change["actions"])
        require(actions in ACTIONS)
        if actions == ("no-op",):
            require(change.get("before") == change.get("after") and not unknown(change.get("after_unknown")))
        counts["/".join(actions)] += 1
        if actions == ("no-op",) and not change.get("importing") and not item.get("previous_address"):
            continue
        flags = []
        if "delete" in actions: flags.append("destructive")
        if "create" in actions and "delete" in actions: flags.append("replacement")
        if "forget" in actions: flags.append("ownership_removal")
        if change.get("importing") or item.get("previous_address"): flags.append("ownership_change")
        if item.get("type") == "aws_lambda_function":
            flags.append("lambda_review")
            if any(changed(change, key) for key in ("source_code_hash", "filename", "s3_bucket", "s3_key", "s3_object_version", "image_uri", "handler", "runtime", "layers", "architectures")):
                flags.append("lambda_code_or_runtime")
            if changed(change, "environment"): flags.append("lambda_environment")
        if item.get("type") == "aws_s3_object": flags.append("object_content_or_metadata")
        if item["address"] in ASYNC_RESOURCES: flags.append("known_async_import_blocker")
        # Hash arbitrary addresses: for_each keys can contain user data/secrets.
        findings.append({"address_sha256": sha(item["address"].encode()), "actions": list(actions), "flags": flags})
    drift = plan.get("resource_drift", [])
    outputs = plan.get("output_changes", {})
    checks = plan.get("checks", [])
    require(isinstance(drift, list) and isinstance(outputs, dict) and isinstance(checks, list))
    require(all(isinstance(c, dict) and c.get("status") == "pass" for c in checks))
    output_changes = 0
    for change in outputs.values():
        require(isinstance(change, dict) and isinstance(change.get("actions"), list))
        require(tuple(change["actions"]) in ACTIONS)
        output_changes += change["actions"] != ["no-op"]
    blocked = bool(findings or drift or output_changes)
    require(blocked or plan["applyable"] is False)
    return {"schema": 1, "result": "review_required" if blocked else "offline_checks_passed",
            "deployment_authorized": False, "live_identity_verified": False,
            "action_counts": dict(counts), "findings": findings, "drift_entries": len(drift),
            "output_changes": output_changes,
            "known_async_blockers_in_plan": sum("known_async_import_blocker" in f["flags"] for f in findings)}, int(blocked)


def local_checks(root, data_dir):
    """Use an already initialized offline provider/module cache; never initialize a backend."""
    root, data_dir = Path(root).resolve(), Path(data_dir).resolve()
    require(root.is_dir() and data_dir.is_dir())
    env = {k: v for k, v in os.environ.items() if not k.startswith(("TF_", "AWS_"))}
    env.update(TF_DATA_DIR=str(data_dir), TF_IN_AUTOMATION="true", CHECKPOINT_DISABLE="1",
               AWS_EC2_METADATA_DISABLED="true", AWS_CONFIG_FILE=str(data_dir / "absent-config"),
               AWS_SHARED_CREDENTIALS_FILE=str(data_dir / "absent-credentials"),
               TF_CLI_CONFIG_FILE=str(data_dir / "absent-terraform-config"))
    results = []
    for args in (("fmt", "-check", "-recursive"), ("validate", "-json")):
        result = subprocess.run(["terraform", f"-chdir={root}", *args], env=env, capture_output=True, text=True, timeout=120)
        entry = {"check": args[0], "passed": result.returncode == 0}
        if args[0] == "validate" and result.returncode == 0:
            validation = json.loads(result.stdout)
            entry["passed"] = validation.get("valid") is True
            entry["warning_count"] = validation.get("warning_count", 0)
        results.append(entry)
    return {"result": "offline_checks_passed" if all(r["passed"] for r in results) else "local_validation_failed",
            "checks": results, "deployment_authorized": False, "live_identity_verified": False}, int(not all(r["passed"] for r in results))


class SafeParser(argparse.ArgumentParser):
    def error(self, message):
        raise InvalidEvidence("Invalid arguments")


def main(argv=None):
    try:
        parser = SafeParser(description=__doc__)
        commands = parser.add_subparsers(dest="command", required=True)
        review = commands.add_parser("inspect")
        for arg in ("expected", "observed", "plan"): review.add_argument("--" + arg, required=True)
        local = commands.add_parser("local")
        local.add_argument("--root", required=True)
        local.add_argument("--data-dir", required=True)
        args = parser.parse_args(argv)
        if args.command == "local":
            evidence, code = local_checks(args.root, args.data_dir)
        else:
            plan_bytes = Path(args.plan).read_bytes()
            observed = load(args.observed)
            require(observed["plan_sha256"] == sha(plan_bytes))
            evidence, code = inspect(load(args.expected), observed, decode(plan_bytes.decode("utf-8-sig")))
            evidence["plan_sha256"] = sha(plan_bytes)
    except Exception:
        # Neither exception details, CLI inputs, Terraform output nor raw JSON are logged.
        evidence, code = {"result": "invalid_or_unavailable_evidence", "deployment_authorized": False,
                          "live_identity_verified": False}, 2
    print(json.dumps(evidence, sort_keys=True))
    return code


if __name__ == "__main__":
    sys.exit(main())

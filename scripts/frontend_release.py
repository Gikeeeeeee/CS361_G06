"""Offline frontend build/integrity tooling. No deployment operations exist here."""
import argparse
import base64
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tempfile
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
CONFIG_KEYS = ("VITE_API_BASE_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_API_VERSION")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def https(value):
    try:
        parsed = urlsplit(value)
        valid = (parsed.scheme == "https" and parsed.hostname and not parsed.username
                 and not parsed.password and not parsed.query and not parsed.fragment
                 and parsed.port in (None, 443) and not re.search(r"[\s\\<>]", value))
    except ValueError:
        valid = False
    require(valid, "Invalid HTTPS configuration; values suppressed")
    return parsed


def configuration(env):
    result = {key: env.get(key, "").strip() for key in CONFIG_KEYS}
    for key in CONFIG_KEYS[:3]:
        require(result[key], f"Missing {key}")
    for key in CONFIG_KEYS[:2]:
        parsed = https(result[key])
        require(parsed.path in ("", "/"), "Base URL must not include an API path")
    result["VITE_API_VERSION"] = result["VITE_API_VERSION"] or "/api/v1"
    require(result["VITE_API_VERSION"] == "/api/v1", "Unsupported API version for current application")
    key = result["VITE_SUPABASE_ANON_KEY"]
    public = key.startswith("sb_publishable_") and len(key) > len("sb_publishable_")
    if not public:
        try:
            payload = key.split(".")[1]
            public = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))).get("role") == "anon"
        except (IndexError, ValueError, UnicodeError, AttributeError):
            public = False
    require(public, "Only a public Supabase publishable/anon key is permitted")
    return result


def digest(data):
    return hashlib.sha256(data).hexdigest()


def inventory(directory):
    directory = Path(directory)
    require(directory.is_dir() and not directory.is_symlink(), "Missing/unsafe artifact directory")
    files = {}
    for path in sorted(directory.rglob("*")):
        require(not path.is_symlink(), "Artifact symlinks are forbidden")
        if path.is_file():
            key = path.relative_to(directory).as_posix()
            require(not key.startswith(("floor-plan/", "building/", "image/")), "Backend asset prefix in frontend artifact")
            require(not any(part.startswith(".") for part in path.relative_to(directory).parts), "Hidden artifact file")
            files[key] = {"sha256": digest(path.read_bytes()), "size": path.stat().st_size}
    require("index.html" in files and len(files) > 1, "Missing frontend entry point/assets")
    return files


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("src"):
            self.paths.append(attrs["src"])
        if tag == "link" and attrs.get("href"):
            self.paths.append(attrs["href"])


def verify_artifact(directory, manifest):
    require(manifest.get("schema") == 1 and manifest.get("deployment_enabled") is False, "Invalid preparation manifest")
    files = inventory(directory)
    require(files == manifest.get("files"), "Artifact hash/path mismatch: wrong or potentially stale content")
    parser = References()
    parser.feed((Path(directory) / "index.html").read_text(encoding="utf-8"))
    require(parser.paths, "Missing entry point asset references")
    external = []
    local_count = 0
    for ref in parser.paths:
        parsed = urlsplit(ref)
        if parsed.scheme or parsed.netloc:
            https(ref)
            external.append(ref)
            continue
        key = unquote(parsed.path).lstrip("/")
        require(not parsed.scheme and not parsed.netloc and not parsed.query and not parsed.fragment
                and ".." not in PurePosixPath(key).parts and key in files, "Untrusted/missing entry point asset")
        local_count += 1
    require(local_count > 0 and sorted(external) == manifest.get("external_references", []), "Unexpected external entry point reference")


def verify_target(aws, target):
    """Preparation guard for future use; injected client must expose read-only AWS APIs.

    Not wired to a workflow/CLI. Matching identity does NOT establish Terraform ownership.
    """
    required = ("account_id", "region", "bucket", "bucket_owner_id", "distribution_id", "distribution_arn")
    require(all(isinstance(target.get(k), str) and target[k] for k in required), "Incomplete target identity")
    require(aws("sts", "get-caller-identity", {})["Account"] == target["account_id"], "Account mismatch")
    args = {"Bucket": target["bucket"], "ExpectedBucketOwner": target["account_id"]}
    owner = aws("s3", "get-bucket-acl", args)["Owner"]["ID"]
    require(owner == target["bucket_owner_id"], "Bucket owner mismatch")
    region = aws("s3", "get-bucket-location", args).get("LocationConstraint") or "us-east-1"
    region = "eu-west-1" if region == "EU" else region
    require(region == target["region"], "Bucket region mismatch")
    dist = aws("cloudfront", "get-distribution", {"Id": target["distribution_id"]})["Distribution"]
    arn = dist["ARN"].split(":")
    require(len(arn) == 6 and arn[2] == "cloudfront" and arn[4] == target["account_id"]
            and arn[5] == "distribution/" + target["distribution_id"]
            and dist["ARN"] == target["distribution_arn"], "Distribution owner/identity mismatch")
    config = dist["DistributionConfig"]
    origins = config["Origins"]["Items"]
    behavior = config["DefaultCacheBehavior"]
    matches = [o for o in origins if o["Id"] == behavior["TargetOriginId"]]
    require(config["Enabled"] and len(origins) == 1 and len(matches) == 1
            and config.get("CacheBehaviors", {}).get("Quantity", 0) == 0, "Unexpected distribution topology")
    origin = matches[0]
    suffix = "amazonaws.com.cn" if arn[1] == "aws-cn" else "amazonaws.com"
    expected = f'{target["bucket"]}.s3.{region}.{suffix}'
    require(origin["DomainName"] == expected and not origin.get("OriginPath")
            and origin.get("OriginAccessControlId"), "Distribution origin mismatch")
    return {"identity_matches": True, "state_ownership_verified": False, "deployment_enabled": False}


def build(output):
    config = configuration(os.environ)
    output = Path(output).resolve()
    require(not output.exists(), "Output must be a new directory")
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    dirty = bool(subprocess.check_output(["git", "status", "--porcelain", "--", "frontend"], cwd=ROOT, text=True))
    npm = "npm.cmd" if os.name == "nt" else "npm"
    node_version = subprocess.check_output(["node", "--version"], text=True).strip()
    npm_version = subprocess.check_output([npm, "--version"], text=True).strip()
    require(tuple(map(int, node_version.lstrip("v").split(".")[:2])) >= (22, 12), "Node 22.12+ required")
    env = {k: v for k, v in os.environ.items() if not k.startswith("VITE_")}
    env.update(config)
    env["NODE_ENV"] = "production"
    with tempfile.TemporaryDirectory(prefix="frontend-build-") as temp:
        source = Path(temp) / "frontend"
        shutil.copytree(ROOT / "frontend", source, ignore=shutil.ignore_patterns(
            "node_modules", "dist", ".env*", "*.local", "test-results", "playwright-report"))
        subprocess.run([npm, "ci", "--include=dev", "--no-audit", "--no-fund"], cwd=source, env=env, check=True)
        subprocess.run([npm, "run", "build"], cwd=source, env=env, check=True)
        entry = References()
        entry.feed((source / "index.html").read_text(encoding="utf-8"))
        external = sorted(ref for ref in entry.paths if urlsplit(ref).scheme or urlsplit(ref).netloc)
        for ref in external:
            https(ref)
        manifest = {"schema": 1, "deployment_enabled": False, "revision": revision,
                    "frontend_dirty": dirty, "node": node_version, "npm": npm_version,
                    "lock_sha256": digest((source / "package-lock.json").read_bytes()),
                    "config_sha256": digest(json.dumps(config, sort_keys=True).encode()),
                    "external_references": external,
                    "files": inventory(source / "dist")}
        verify_artifact(source / "dist", manifest)
        output.mkdir(parents=True)
        shutil.copytree(source / "dist", output / "dist")
        (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("build").add_argument("--output", required=True)
    sub.add_parser("verify").add_argument("--artifact", required=True)
    args = parser.parse_args()
    try:
        if args.command == "build":
            build(args.output)
        else:
            artifact = Path(args.artifact)
            verify_artifact(artifact / "dist", json.loads((artifact / "manifest.json").read_text(encoding="utf-8")))
        print("Frontend preparation passed; deployment remains disabled.")
        return 0
    except (ValueError, OSError, KeyError, subprocess.SubprocessError):
        print("Frontend preparation failed; check configuration, artifact integrity or build output. No deployment attempted.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

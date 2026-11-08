"""Offline preparation tests: injected AWS functions never access a network."""
import importlib.util
import json
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("frontend_release", Path(__file__).parents[1] / "frontend_release.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def config():
    return {"VITE_API_BASE_URL": "https://api.example.test", "VITE_SUPABASE_URL": "https://auth.example.test",
            "VITE_SUPABASE_ANON_KEY": "sb_publishable_test_fixture"}


@pytest.mark.parametrize("key", release.CONFIG_KEYS[:3])
def test_missing_configuration(key):
    values = config()
    del values[key]
    with pytest.raises(ValueError, match="Missing"):
        release.configuration(values)


@pytest.mark.parametrize("value", ["http://api.example.test", "https://user:pass@api.example.test", "https://api.example.test/api/v1", "https://api.example.test?token=private", "https://<placeholder>"])
def test_invalid_base(value):
    values = config()
    values["VITE_API_BASE_URL"] = value
    with pytest.raises(ValueError) as error:
        release.configuration(values)
    assert value not in str(error.value)


def test_public_key_only():
    values = config()
    assert release.configuration(values)["VITE_API_VERSION"] == "/api/v1"
    values["VITE_SUPABASE_ANON_KEY"] = "sb_secret_never_bundle"
    with pytest.raises(ValueError, match="public"):
        release.configuration(values)


@pytest.fixture
def artifact(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text('<script type="module" src="/assets/app.js"></script><link rel="icon" href="/logo.svg">')
    (tmp_path / "assets/app.js").write_text("console.log('fixture')")
    (tmp_path / "logo.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
    return tmp_path, {"schema": 1, "deployment_enabled": False, "files": release.inventory(tmp_path)}


def test_artifact_integrity(artifact):
    directory, manifest = artifact
    release.verify_artifact(directory, manifest)


@pytest.mark.parametrize("change", ["js", "svg", "missing", "extra", "index"])
def test_wrong_or_stale_body_rejected(artifact, change):
    directory, manifest = artifact
    if change == "missing":
        (directory / "logo.svg").unlink()
    else:
        filename = {"js": "assets/app.js", "svg": "logo.svg", "extra": "extra.txt", "index": "index.html"}[change]
        (directory / filename).write_text("changed")
    with pytest.raises(ValueError, match="mismatch"):
        release.verify_artifact(directory, manifest)


@pytest.mark.parametrize("ref", ["https://external.example.test/app.js", "/assets/missing.js", "../outside.js", "/assets/app.js?token=value"])
def test_reference_must_match_manifest(artifact, ref):
    directory, manifest = artifact
    (directory / "index.html").write_text(f'<script src="{ref}"></script>')
    manifest["files"] = release.inventory(directory)
    with pytest.raises(ValueError):
        release.verify_artifact(directory, manifest)


def test_existing_external_dependencies_recorded_not_fetched(artifact):
    directory, manifest = artifact
    ref = "https://external.example.test/pinned-library.js"
    with (directory / "index.html").open("a") as entry:
        entry.write(f'<script src="{ref}"></script>')
    manifest["files"] = release.inventory(directory)
    manifest["external_references"] = [ref]
    release.verify_artifact(directory, manifest)


def test_backend_svg_namespace_excluded(artifact):
    directory, _ = artifact
    (directory / "floor-plan").mkdir()
    (directory / "floor-plan/fixture.svg").write_text("fixture")
    with pytest.raises(ValueError, match="Backend"):
        release.inventory(directory)


def identity():
    target = dict(account_id="fixture-account", region="fixture-region", bucket="fixture-bucket",
                  bucket_owner_id="fixture-owner", distribution_id="fixture-distribution",
                  distribution_arn="arn:aws:cloudfront::fixture-account:distribution/fixture-distribution")
    replies = {
        "get-caller-identity": {"Account": target["account_id"]},
        "get-bucket-acl": {"Owner": {"ID": target["bucket_owner_id"]}},
        "get-bucket-location": {"LocationConstraint": target["region"]},
        "get-distribution": {"Distribution": {"ARN": target["distribution_arn"], "DistributionConfig": {
            "Enabled": True, "DefaultCacheBehavior": {"TargetOriginId": "frontend"},
            "Origins": {"Items": [{"Id": "frontend", "DomainName": "fixture-bucket.s3.fixture-region.amazonaws.com", "OriginAccessControlId": "fixture-oac"}]}}}}
    }
    return target, replies


def test_matching_identity_never_enables_deployment():
    target, replies = identity()
    calls = []
    def aws(service, operation, args):
        calls.append((service, operation, args))
        return replies[operation]
    assert release.verify_target(aws, target) == dict(identity_matches=True, state_ownership_verified=False, deployment_enabled=False)
    assert len(calls) == 4
    assert all(op.startswith("get-") for _, op, _ in calls)
    assert calls[1][2]["ExpectedBucketOwner"] == target["account_id"]


@pytest.mark.parametrize("fault", ["account", "bucket", "region", "distribution", "origin", "path", "cache", "permission"])
def test_identity_fails_closed(fault):
    target, replies = identity()
    config = replies["get-distribution"]["Distribution"]["DistributionConfig"]
    if fault == "account": replies["get-caller-identity"]["Account"] = "wrong"
    if fault == "bucket": replies["get-bucket-acl"]["Owner"]["ID"] = "wrong"
    if fault == "region": replies["get-bucket-location"]["LocationConstraint"] = "wrong"
    if fault == "distribution": replies["get-distribution"]["Distribution"]["ARN"] = "wrong"
    if fault == "origin": config["Origins"]["Items"][0]["DomainName"] = "wrong"
    if fault == "path": config["Origins"]["Items"][0]["OriginPath"] = "/floor-plan"
    if fault == "cache": config["CacheBehaviors"] = {"Quantity": 1}
    def aws(service, operation, args):
        if fault == "permission": raise PermissionError("denied")
        return replies[operation]
    with pytest.raises((ValueError, PermissionError)):
        release.verify_target(aws, target)


def test_missing_identity_does_not_call_aws():
    with pytest.raises(ValueError, match="Incomplete"):
        release.verify_target(lambda *args: pytest.fail("AWS must not be called"), {})


def test_build_bad_config_fails_before_any_command(monkeypatch, tmp_path):
    for key in release.CONFIG_KEYS: monkeypatch.delenv(key, raising=False)
    monkeypatch.setattr(release.subprocess, "check_output", lambda *a, **k: pytest.fail("command executed"))
    with pytest.raises(ValueError, match="Missing"):
        release.build(tmp_path / "output")


def test_build_isolated_locked_and_no_aws(monkeypatch, tmp_path):
    root = tmp_path / "repo"
    frontend = root / "frontend"
    frontend.mkdir(parents=True)
    (frontend / "package-lock.json").write_text('{"lockfileVersion":3}')
    (frontend / "index.html").write_text('<script src="/src/main.tsx"></script>')
    (frontend / ".env.local").write_text("VITE_UNEXPECTED=private")
    monkeypatch.setattr(release, "ROOT", root)
    for key, value in config().items(): monkeypatch.setenv(key, value)
    monkeypatch.setenv("VITE_UNEXPECTED", "private")
    calls = []
    def output(command, **kwargs):
        if command[:2] == ["git", "rev-parse"]: return "fixture-revision\n"
        if command[:2] == ["git", "status"]: return ""
        if command[0] == "node": return "v22.17.0\n"
        return "11.4.2\n"
    def run(command, cwd, env, check):
        calls.append(command)
        assert check and Path(cwd) != frontend
        assert not (Path(cwd) / ".env.local").exists()
        assert "VITE_UNEXPECTED" not in env
        if command[1:] == ["run", "build"]:
            dist = Path(cwd) / "dist"
            (dist / "assets").mkdir(parents=True)
            (dist / "index.html").write_text('<script src="/assets/app.js"></script>')
            (dist / "assets/app.js").write_text("fixture")
    monkeypatch.setattr(release.subprocess, "check_output", output)
    monkeypatch.setattr(release.subprocess, "run", run)
    destination = tmp_path / "prepared"
    release.build(destination)
    assert calls[0][1:] == ["ci", "--include=dev", "--no-audit", "--no-fund"]
    assert calls[1][1:] == ["run", "build"]
    manifest = json.loads((destination / "manifest.json").read_text())
    assert manifest["revision"] == "fixture-revision"
    assert "sb_publishable" not in (destination / "manifest.json").read_text()
    release.verify_artifact(destination / "dist", manifest)
    with pytest.raises(ValueError, match="new directory"):
        release.build(destination)

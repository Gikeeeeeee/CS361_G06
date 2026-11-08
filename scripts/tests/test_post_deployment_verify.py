"""No live endpoints: reuse HTTP-boundary fixtures for the combined verifier."""
import json
from pathlib import Path
import socket

import pytest

from scripts import frontend_release as frontend
from scripts import post_deployment_verify as verify
from scripts.tests.test_smoke_test import API, CDN, KEY, scenario


FRONTEND = "https://frontend.example.test"


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    monkeypatch.setattr(socket, "create_connection", lambda *a, **k: pytest.fail("Live network access forbidden"))


@pytest.fixture
def deployment(tmp_path, scenario, monkeypatch):
    monkeypatch.setattr(verify, "verify_source_baseline", lambda *a: None)
    directory = tmp_path / "release"
    dist = directory / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text('<script src="/assets/app.js"></script><link rel="icon" href="/logo.svg">')
    (dist / "assets/app.js").write_text("console.log('approved fixture')")
    (dist / "logo.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
    manifest = {"schema": 1, "deployment_enabled": False, "revision": "a" * 40,
                "frontend_dirty": False, "files": frontend.inventory(dist)}
    receipt = {"mode": "deployment", "authorized": True, "status": "success", "targets_verified": True,
               "commit": "a" * 40, "approval_reference": "fixture-approved-environment-review",
               "deployment_run_url": "https://github.example.test/fixture/repo/actions/runs/1",
               "backend": {"api_base_url": API, "asset_base_url": CDN}, "frontend": {"base_url": FRONTEND}}
    for key in manifest["files"]:
        suffix = Path(key).suffix
        mime = {".html": "text/html", ".js": "text/javascript", ".svg": "image/svg+xml"}[suffix]
        scenario[1][FRONTEND + "/" + key] = ((dist / key).read_bytes(), mime, 200)
    scenario[1][FRONTEND + "/"] = ((dist / "index.html").read_bytes(), "text/html", 200)
    (directory / "manifest.json").write_text(json.dumps(manifest))
    return receipt, manifest, directory, scenario


def execute(deployment):
    receipt, manifest, directory, scenario = deployment
    return verify.run(receipt, manifest, directory / "dist", scenario[0], client=scenario[4])


def test_approved_deployment_checks_api_svg_and_every_frontend_file(deployment):
    result, code = execute(deployment)
    assert code == 0 and result["backend_api_svg"] == result["frontend_artifacts"] == "passed"
    assert result["remote_writes"] is False
    assert len(deployment[3][3].calls) == 4 + len(deployment[1]["files"]) + 1


@pytest.mark.parametrize("field,value", [("mode", "dry_run"), ("authorized", False), ("authorized", "true"),
    ("status", "failure"), ("targets_verified", False), ("commit", "b" * 40), ("approval_reference", "")])
def test_receipt_gate_stops_before_any_request(deployment, field, value):
    deployment[0][field] = value
    assert execute(deployment)[1] == 2
    assert not deployment[3][3].calls


def test_dirty_or_changed_baseline_stops_before_any_request(deployment):
    deployment[1]["frontend_dirty"] = True
    assert execute(deployment)[1] == 2
    deployment[1]["frontend_dirty"] = False
    (deployment[2] / "dist/assets/app.js").write_text("unapproved")
    assert execute(deployment)[1] == 2
    assert not deployment[3][3].calls


@pytest.mark.parametrize("path", ["/", "/assets/app.js", "/logo.svg"])
def test_stale_content_or_spa_200_fallback_is_not_success(deployment, path):
    deployment[3][1][FRONTEND + path] = (b"<html>old release or SPA fallback</html>", "text/html", 200)
    result, code = execute(deployment)
    assert code == 1 and result["failure_category"] == "FRONTEND_ARTIFACT_MISMATCH"
    assert result["backend_api_svg"] == "passed" and result["frontend_artifacts"] == "failed"


def test_wrong_frontend_mime_rejected_even_if_hash_matches(deployment):
    body, _, status = deployment[3][1][FRONTEND + "/assets/app.js"]
    deployment[3][1][FRONTEND + "/assets/app.js"] = body, "text/html", status
    assert execute(deployment)[0]["failure_category"] == "FRONTEND_CONTENT_TYPE"


@pytest.mark.parametrize("status", [404, 503])
def test_frontend_availability_failure_is_reported_without_rollback(deployment, status):
    deployment[3][1][FRONTEND + "/"] = (b"PRIVATE_RESPONSE_BODY", "text/html", status)
    result, code = execute(deployment)
    assert code == 1 and result["failure_category"] == "FRONTEND_UNAVAILABLE"
    assert result["backend_api_svg"] == "passed" and result["frontend_artifacts"] == "failed"
    assert "PRIVATE_RESPONSE_BODY" not in json.dumps(result)


def test_svg_mismatch_prevents_frontend_checks(deployment):
    deployment[3][1][CDN + "/" + KEY] = (b'<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>', "image/svg+xml", 200)
    result, code = execute(deployment)
    assert code == 1 and result["failure_category"] == "ASSET_MISMATCH"
    assert not any(call.full_url.startswith(FRONTEND) for call in deployment[3][3].calls)


def test_failure_logs_do_not_expose_signed_urls_or_tokens(deployment, capsys, tmp_path):
    receipt = deployment[0]
    receipt["backend"]["api_base_url"] = "https://api.example.test?token=PRIVATE_TOKEN"
    path = tmp_path / "receipt.json"
    path.write_text(json.dumps(receipt))
    assert verify.main(["--receipt", str(path), "--artifact", str(deployment[2]), "--assets-dir", str(deployment[3][0])], client=deployment[3][4]) == 2
    output = capsys.readouterr().out
    assert "PRIVATE_TOKEN" not in output and "https://" not in output
    assert not deployment[3][3].calls


def test_missing_receipt_cannot_be_bypassed(capsys):
    assert verify.main(["--force=PRIVATE_TOKEN"]) == 2
    assert "PRIVATE_TOKEN" not in capsys.readouterr().out


def test_primary_dry_run_never_invokes_the_post_deployment_verifier():
    workflow = (Path(__file__).resolve().parents[2] / ".github/workflows/cd.yml").read_text()
    assert "post_deployment_verify.py" not in workflow and "scripts/smoke_test.py" not in workflow


@pytest.mark.parametrize("fault", [None, "wrong_revision", "dirty", "untracked"])
def test_backend_baseline_requires_clean_tracked_release_checkout(tmp_path, monkeypatch, fault):
    assets = tmp_path / "building-data"
    assets.mkdir()
    outputs = [str(tmp_path), "b" * 40 if fault == "wrong_revision" else "a" * 40]
    if fault != "wrong_revision":
        outputs.append(" M building-data/fixture.svg" if fault == "dirty" else "")
        if fault != "dirty": outputs.append("" if fault == "untracked" else "building-data/fixture.svg")
    calls = []
    def git(args, **kwargs):
        calls.append(args)
        assert args[0] == "git" and "fetch" not in args and "checkout" not in args
        return outputs.pop(0)
    monkeypatch.setattr(verify.subprocess, "check_output", git)
    if fault:
        with pytest.raises(verify.smoke.SmokeError): verify.verify_source_baseline(assets, "a" * 40)
    else:
        verify.verify_source_baseline(assets, "a" * 40)
    assert calls

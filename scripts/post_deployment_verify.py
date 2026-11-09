"""Read-only checks after a separately authorized successful deployment.

No deployment, AWS discovery, upload or invalidation operation exists here.
A receipt is trusted operator/pipeline input, not a cryptographic attestation.
"""
import argparse
from pathlib import Path
import re
import subprocess
from urllib.parse import quote

if __package__:
    from . import frontend_release as frontend
    from . import smoke_test as smoke
    from .sandbox_validation import load
else:
    import frontend_release as frontend
    import smoke_test as smoke
    from sandbox_validation import load

import json


MIME_TYPES = {
    ".html": {"text/html"}, ".js": {"application/javascript", "text/javascript"},
    ".css": {"text/css"}, ".svg": {"image/svg+xml"}, ".json": {"application/json"},
    ".png": {"image/png"}, ".jpg": {"image/jpeg"}, ".webp": {"image/webp"},
}


def verify_source_baseline(assets_dir, revision):
    """Require a clean tracked asset checkout at the approved deployment commit."""
    assets_dir = Path(assets_dir).resolve()
    git = lambda args, cwd: subprocess.check_output(["git", "-C", str(cwd), *args], text=True, stderr=subprocess.DEVNULL).strip()
    root = Path(git(["rev-parse", "--show-toplevel"], assets_dir)).resolve()
    smoke.require(assets_dir.is_relative_to(root) and assets_dir != root,
                  "CONFIGURATION", "Asset baseline must be inside its trusted release checkout.")
    relative = assets_dir.relative_to(root).as_posix()
    smoke.require(git(["rev-parse", "HEAD"], root) == revision
                  and not git(["status", "--porcelain", "--untracked-files=all", "--ignored", "--", relative], root)
                  and bool(git(["ls-files", "--", relative], root)),
                  "CONFIGURATION", "Assets must be tracked and unchanged at the approved deployment commit.")


def preflight(receipt, manifest, artifact_dir, assets_dir):
    smoke.require(receipt.get("mode") == "deployment" and receipt.get("authorized") is True
                  and receipt.get("status") == "success" and receipt.get("targets_verified") is True,
                  "AUTHORIZATION", "A trusted, authorized successful deployment receipt is required; dry runs cannot verify a release.")
    revision = receipt.get("commit")
    smoke.require(isinstance(revision, str) and re.fullmatch(r"[0-9a-f]{40}", revision)
                  and revision == manifest.get("revision") and manifest.get("frontend_dirty") is False,
                  "CONFIGURATION", "Receipt and clean build manifest must identify the same full commit.")
    smoke.require(smoke.nonempty_string(receipt.get("approval_reference")), "AUTHORIZATION", "Approval provenance is required.")
    smoke.https_url(receipt["deployment_run_url"], base=True)
    for value in (receipt["backend"]["api_base_url"], receipt["backend"]["asset_base_url"]):
        smoke.https_url(value, base=True)
    website = smoke.https_url(receipt["frontend"]["base_url"], base=True)
    smoke.require(website.path in ("", "/"), "CONFIGURATION", "Frontend origin must match the root-path build configuration.")
    # All local checks precede the first network request. The manifest itself
    # must come from an approved, immutable artifact source outside this tool.
    frontend.verify_artifact(artifact_dir, manifest)
    verify_source_baseline(assets_dir, revision)


def verify_frontend(base, manifest, client):
    """Compare root HTML and every static object to the approved exact-byte manifest."""
    base = base.rstrip("/")
    files = manifest["files"]
    requests = [("", "index.html")] + [(key, key) for key in sorted(files)]
    for path, key in requests:
        try:
            body, mime = client.get(base + "/" + quote(path, safe="/"), "frontend artifact")
        except smoke.SmokeError:
            raise smoke.SmokeError("FRONTEND_UNAVAILABLE", "Frontend retrieval failed; response details suppressed.") from None
        expected = files[key]
        smoke.require(len(body) == expected["size"] and frontend.digest(body) == expected["sha256"],
                      "FRONTEND_ARTIFACT_MISMATCH", "Frontend content differs from the trusted release; HTTP 200 is insufficient.")
        allowed = MIME_TYPES.get(Path(key).suffix.lower())
        smoke.require(not allowed or mime in allowed, "FRONTEND_CONTENT_TYPE", "Frontend artifact has an unexpected content type.")


def run(receipt, manifest, artifact_dir, assets_dir, *, client=None):
    result = {"result": "failed", "backend_api_svg": "not_run", "frontend_artifacts": "not_run",
              "remote_writes": False}
    def failure(category, code):
        for key in ("backend_api_svg", "frontend_artifacts"):
            if result[key] == "checking": result[key] = "failed"
        result["failure_category"] = category
        return result, code
    try:
        preflight(receipt, manifest, artifact_dir, assets_dir)
        client = client if client is not None else smoke.HttpClient()
        result["backend_api_svg"] = "checking"
        smoke.run_smoke(receipt["backend"]["api_base_url"], receipt["backend"]["asset_base_url"],
                        Path(assets_dir), client=client)
        result["backend_api_svg"] = "passed"
        result["frontend_artifacts"] = "checking"
        verify_frontend(receipt["frontend"]["base_url"], manifest, client)
        result["frontend_artifacts"] = "passed"
        result["result"] = "passed"
        return result, 0
    except smoke.SmokeError as error:
        return failure(error.category, 2 if error.category in ("AUTHORIZATION", "CONFIGURATION") else 1)
    except Exception:
        return failure("RECEIPT_OR_BASELINE_UNAVAILABLE", 2)


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise ValueError("Invalid verification arguments")


def main(argv=None, *, client=None):
    try:
        parser = Parser(description=__doc__)
        parser.add_argument("--receipt", required=True)
        parser.add_argument("--artifact", required=True, help="Approved directory containing dist/ and manifest.json")
        parser.add_argument("--assets-dir", type=Path, default=Path(__file__).resolve().parents[1] / "building-data")
        args = parser.parse_args(argv)
        artifact = Path(args.artifact)
        evidence, code = run(load(args.receipt), load(artifact / "manifest.json"), artifact / "dist",
                             args.assets_dir, client=client)
    except Exception:
        evidence, code = {"result": "failed", "failure_category": "RECEIPT_OR_BASELINE_UNAVAILABLE",
                          "backend_api_svg": "not_run", "frontend_artifacts": "not_run", "remote_writes": False}, 2
    # Never echo receipt fields, endpoint/asset paths, response bodies or exceptions.
    print(json.dumps(evidence, sort_keys=True))
    return code


if __name__ == "__main__":
    raise SystemExit(main())

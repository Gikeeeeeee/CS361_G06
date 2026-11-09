# CS361 V5 final verification

This review uses the existing local VS Code checkout `C:\CS361_G06`, on
`feature/v5/final-verification`, created from fetched `origin/main` at
`c135c168a41834350b8d3e28bee8a91014f27096`. The original
`feature/v5/ci-validation` branch is preserved at `e4ffe1d`. No new clone or
worktree was created. Initial tracked/untracked status was clean.

## Requirement-to-evidence matrix

| Requirement | Implementation and evidence | Status / limits |
|---|---|---|
| Automated CI | [ci.yml](.github/workflows/ci.yml) runs on PRs targeting `main`/`V4`. [Prior run 42634194736](https://github.com/Gikeeeeeee/CS361_G06/actions/runs/42634194736), head `8bb24e6`, passed Python Tests and Terraform Validate. This branch adds frontend validation and focused guard/asset-checker tests to that workflow. | Existing backend automation verified remotely; new frontend job requires this PR's run. No production deployment. |
| Backend Terraform Validation | CI uses `terraform init -backend=false` then `terraform validate`. The prior CI run and [manual dry run](https://github.com/Gikeeeeeee/CS361_G06/actions/runs/42634534227) both passed validate. Local Terraform 1.15.8 validation also passes using the existing provider/module cache. | Configuration validity established; 14 existing DynamoDB deprecation warnings. Validation proves neither live ownership nor deployability. |
| Manual Backend Dry Run | [backend-dry-run.yml](.github/workflows/backend-dry-run.yml), manual dispatch on `main` only. Run 42634534227, attempt 1, head `c135c16`, started 2026-11-09 14:25:29 UTC (21:25:29 Asia/Bangkok). Init/validate/plan succeeded; plan exit 2, **2 add / 21 change / 1 destroy**. | Run conclusion **failure**, because Plan Safety blocked it. No apply, state repair, frontend operation or post-deployment check. |
| Safety Guard | [deployment_guard.py](scripts/deployment_guard.py) returned `unsafe_resource_changes`, `PLAN_CHANGES_BLOCKED`, phase `plan_safety`, `failure_count: 4`, `apply_permitted: false` in [job 129219085729](https://github.com/Gikeeeeeee/CS361_G06/actions/runs/42634534227/job/129219085729). Local guard/diagnostic/workflow regressions: **103 passed**. | Refusal verified. Two Lambda artifact findings, one create finding and refresh drift remain unresolved. Guard policy is unchanged. |
| Frontend Build and SVG Integrity | Actual commands: `npm run lint` (Oxlint), `npm run test:svg`, `npm run test:corridors` (Playwright), `npm run build` (`tsc -b && vite build`), plus [verify_svg_assets.py](scripts/verify_svg_assets.py). Six SVGs: five floor plans and the public logo. | Offline results recorded below. Checks cannot establish freshness of deployed S3 objects or CloudFront responses. |
| Infrastructure Ownership | Frontend root declares `module.s3_website`; backend root declares `module.storage`. Backend [backend.tf](terraform/terraform-backend/backend.tf) fixes S3 bucket/key/region and lockfile use. Run logs show backend media resource addresses. | Source ownership established; live frontend ownership is **unverified**. No frontend remote backend or current state reference is committed. No redundant pipeline or state change. |
| Production Deployment Limitations | GitHub workflow metadata reports `CD` as **disabled_manually**. Its [unchanged source](.github/workflows/cd.yml) still contains main-push apply behavior. Manual dry run cannot apply even on guard success. | No production readiness or deployment completion claimed. No CD enablement, merge, apply, upload, invalidation or AWS resource changes performed. |

## Backend risk review

Evidence is the existing run's job/step metadata and decoded job logs, inspected
through the GitHub connector. Workflow enablement and run metadata were read with
local `gh` because the connector does not expose those queries. No workflow was
dispatched during this review. The run returned an empty artifact list; no raw
plan/state/tfvars or credentials are added to the repository.

| Planned area | Confirmed observation | Risk / remaining evidence |
|---|---|---|
| Lambda API and indexer | Both `module.lambda.aws_lambda_function.this` and `.indexer` update in place with `source_code_hash` becoming known only after apply. `archive_file.package` is deferred behind the packaging helper. | Existing function identities and a successful Docker build do not prove artifact compatibility or exclude rollback. Both hashes are blocked. No runtime compatibility or deployed async-import preservation is established. No environment change is shown in this run's text diff; do not carry older environment-change claims forward as confirmed here. |
| Local packaging helper | `module.lambda.terraform_data.build` is replaced because source/build/dependency hashes differ. Guard reports `existing_local_packaging_helper_only`. | This one local replacement accounts for one add and the one destroy; it is not an AWS deletion. Its narrow exception does not approve the two Lambda code changes. `build.py` uses Linux/amd64 Python 3.12, an unpinned image tag, partially unpinned dependencies, and can reuse existing packages after a Docker failure on a warm checkout. Packaging reproducibility remains unproven; no packaging behavior is changed here. |
| CloudFront media CDN | New `module.storage.aws_cloudfront_cache_policy.floor_plans`, TTL min 0/default 300/max 300, and an in-place `ordered_cache_behavior.cache_policy_id` change on `.assets`. | This new policy is the other add and matches the create-action finding; it is still blocked. The configuration limits caching for `floor-plan/*` while images keep their existing policy. Live CORS, content encoding and cache convergence are unverified. This is the backend media CDN, not the frontend website distribution. |
| S3 JSON | Building index plus `LC3.json`/`LC4.json`: three in-place updates with changed ETags and Windows-to-runner `source` paths. | These are planned content changes, not just path noise. JSON/SVG/API consistency and impact on existing data need deployment review. |
| S3 SVG | All five floor plans update ETags/source paths and add `public, max-age=0, s-maxage=300, must-revalidate`. | Local XML/reference checks pass, but cannot attest deployed object bytes, metadata or browser behavior against the live CDN. |
| S3 images | Ten image objects show source-path changes from `C:/CS361_G06/...` to the Linux runner path, with version IDs becoming unknown. No image ETag change is shown. | Cross-host path differences can still schedule uploads/new versions. Do not label all 21 updates harmless or use local integrity checks to approve uploads. |
| Refresh drift | Guard explicitly reports `unreviewed_refresh_drift`. | The sanitized finding contains no resource/field details, and no plan artifact was retained. Exact drift cause and affected resources are unresolved. Do not infer an async-import deletion or repair state from this evidence. A separately authorized, privately reviewed fresh plan is needed before any deployment decision. |

The 21 updates reconcile as two Lambdas, one media CDN, three JSON objects,
five SVG objects and ten image objects. The displayed destroy belongs to the
local helper; this run's action list does not show an AWS deletion. The four
guard findings count policy failures, not every planned resource change.
No guard exception, identity framework or relaxation is added.

## Infrastructure ownership boundary

| Stack | Source addresses / state references | Conclusion |
|---|---|---|
| `terraform/terraform-frontend` | `module.s3_website.aws_s3_bucket.this`, `.aws_cloudfront_distribution.this`, OAC, bucket policy and `.aws_s3_object.frontend_files`. Upload sources are `../../frontend/dist`. Root has no `backend` block. | Intended owner of the website S3 bucket and CloudFront distribution. Without a backend override, Terraform would default to local state. No root state file was found in this local stack; installed module/provider caches and ignored tfvars are not ownership proof. |
| `terraform/terraform-backend` | `module.storage.aws_s3_bucket.this`, `.aws_cloudfront_distribution.assets`, building JSON/floor-plan/image objects. S3 backend `cs361-g06-terraform-state`, key `terraform/backend/terraform.tfstate`, region `ap-southeast-2`, default workspace; source includes moved blocks for former root storage addresses. | Owns building-data/media infrastructure in configuration and the referenced backend dry run. It does not call `module.s3_website` or upload frontend `dist`. Backend state storage region is distinct from the AWS provider's `var.aws_region`. |

The committed `terraform/terraform-backend/state-backup-20261002-192144.json`
is a historical backup, not current ownership evidence. No live AWS lookup or
remote state pull was performed. No Terraform state file was modified, migrated,
imported or refreshed. The specific live website bucket/distribution cannot be
bound to a current state from this evidence. An owner must privately verify the
actual frontend state location/workspace and matching resource identities before
designing any frontend infrastructure deployment workflow.

## Local validation

Commands ran in this same checkout, with no remote backend init or local plan.
Both Terraform validations used existing local provider/module caches.

| Check | Result |
|---|---|
| `npm run lint` | Passed, existing React/hooks/unused-variable warnings; no lint errors. |
| `npm run test:svg` | Passed: deduplication, cache/revalidation, HTTP/XML/network errors, signed URL expiry, retry, A/B/A races and floor-selection response ordering. |
| `npm run test:corridors` | **15 passed**, exit 0, using the existing Chromium executable. Initial sandboxed attempt passed all cases but stalled at teardown; it was stopped and rerun outside the sandbox successfully (28.1 seconds). |
| `npm run build` | Passed with explicit offline fixtures, TypeScript compilation and Vite production bundling. Existing >500 kB chunk-size advisory. |
| `python scripts/verify_svg_assets.py --build-dir frontend/dist` | Passed for all six SVG files, JSON floor-plan references, local public URLs and fresh built copies. No missing or stale files detected within these checks. |
| Focused guard/workflow pytest files | **103 passed**. |
| `python -m pytest -q scripts/tests/test_verify_svg_assets.py -p no:cacheprovider` | **7 passed**: valid assets, malformed/non-SVG XML, case-sensitive missing/stale plans, missing public reference and missing/stale build copies. |
| `terraform validate -no-color` in both roots | Backend passed with 14 existing deprecation warnings; frontend passed without warnings. |
| Workflow syntax / `git diff --check` | Actionlint 1.7.12 passed for edited `ci.yml` (optional ShellCheck/Pyflakes integrations disabled); diff whitespace check passed. |

The build uses explicit offline values for API base/version and Supabase
URL/key, overriding local `.env`; it is validation output, not a deployable
artifact. Mocked corridor tests abort non-local requests. There is no generic
`npm test` command. Existing auth/bookmark/checkpoint/US4 scripts and the live
SVG browser probe contact deployed services (some write test data), so they were
not run. Offline SVG checks cover XML roots, reference completeness and public
build copies; they do not prove room geometry/ID alignment or live cache/CORS.

Production remains blocked by the documented plan findings and unknown frontend
state ownership. Effective AWS permissions/read-only enforcement and runtime
compatibility are not independently certified by local tests. Lock-free dry-run
snapshots can become stale. Any later deployment requires a fresh reviewed plan
and separate owner authorization; this PR is verification evidence only.

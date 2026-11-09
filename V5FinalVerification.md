# CS361 V5 final verification

This consolidation uses the existing local VS Code checkout `C:\CS361_G06`, on
`feature/v5/ci-validation`, the existing draft [PR #288](https://github.com/Gikeeeeeee/CS361_G06/pull/288)
targeting `V5`. Initial status was clean. No branch, clone or worktree was created.
Main's backend guard is integrated from fetched `origin/main` at
`c135c168a41834350b8d3e28bee8a91014f27096`. Relevant frontend verification and
evidence are integrated from [PR #294](https://github.com/Gikeeeeeee/CS361_G06/pull/294),
`origin/feature/v5/final-verification` at `ac6783d9a12fe9453453ef5bc4fa4719a33f9e40`.
The existing build/artifact pipeline, automation tests, dry-run CD implementation
and receipt-gated post-deployment verification are retained.

## Requirement-to-evidence matrix

| Requirement | Implementation and evidence | Status / limits |
|---|---|---|
| Automated CI | [ci.yml](.github/workflows/ci.yml) preserves PR #288's `main`/`V4`/`V5` triggers, Python/automation tests, isolated locked frontend build, manifest/integrity verification, retained artifact and both Terraform roots. Adds lint, SVG regressions, mocked browser tests and SVG asset checks from #294. | [Consolidated run 42642406031](https://github.com/Gikeeeeeee/CS361_G06/actions/runs/42642406031), implementation commit `5795396`, **success** across all four jobs. It fixes the browser failure in [#294 run 42639093191](https://github.com/Gikeeeeeee/CS361_G06/actions/runs/42639093191). |
| Backend Terraform Validation | CI uses `terraform init -backend=false` then `terraform validate`. The prior CI run and [manual dry run](https://github.com/Gikeeeeeee/CS361_G06/actions/runs/42634534227) both passed validate. Local Terraform 1.15.8 validation also passes using the existing provider/module cache. | Configuration validity established; 14 existing DynamoDB deprecation warnings. Validation proves neither live ownership nor deployability. |
| Manual Backend Dry Run | Main's [backend-dry-run.yml](https://github.com/Gikeeeeeee/CS361_G06/blob/c135c168a41834350b8d3e28bee8a91014f27096/.github/workflows/backend-dry-run.yml), manual dispatch on `main` only. Run 42634534227, attempt 1, head `c135c16`, started 2026-11-09 14:25:29 UTC (21:25:29 Asia/Bangkok). Init/validate/plan succeeded; plan exit 2, **2 add / 21 change / 1 destroy**. PR #288's existing [cd.yml](.github/workflows/cd.yml) remains dry-run only. | Run conclusion **failure**, because Plan Safety blocked it. No apply, state repair, frontend operation or post-deployment check. No additional dry-run pipeline is added to #288. |
| Safety Guard | Main's [deployment_guard.py](scripts/deployment_guard.py) returned `unsafe_resource_changes`, `PLAN_CHANGES_BLOCKED`, phase `plan_safety`, `failure_count: 4`, `apply_permitted: false` in [job 129219085729](https://github.com/Gikeeeeeee/CS361_G06/actions/runs/42634534227/job/129219085729). Current source and guard/diagnostic tests match main. | Refusal verified. Two Lambda artifact findings, one create finding and refresh drift remain unresolved. Obsolete marker/account/ARN requirements are removed; existing action, identity, IAM, Lambda, drift and completeness protections remain. |
| Frontend Build and SVG Integrity | Actual commands: `npm run lint` (Oxlint), `npm run test:svg`, `npm run test:corridors` (Playwright), `npm run build` (`tsc -b && vite build`), plus [verify_svg_assets.py](scripts/verify_svg_assets.py). Six SVGs: five floor plans and the public logo. | Offline results recorded below. Checks cannot establish freshness of deployed S3 objects or CloudFront responses. |
| Infrastructure Ownership | Frontend root declares `module.s3_website`; backend root declares `module.storage`. Backend [backend.tf](terraform/terraform-backend/backend.tf) fixes S3 bucket/key/region and lockfile use. Run logs show backend media resource addresses. | Source ownership established; live frontend ownership is **unverified**. No frontend remote backend or current state reference is committed. No redundant pipeline or state change. |
| Production Deployment Limitations | GitHub metadata previously reported `CD` as **disabled_manually**. Main's legacy source contains apply; PR #288's retained [cd.yml](.github/workflows/cd.yml) contains dry-run behavior only. Existing [post_deployment_verify.py](scripts/post_deployment_verify.py) remains receipt-gated and is not invoked by CI/CD. | No production readiness or deployment completion claimed. No CD enablement, merge, apply, frontend upload, invalidation or AWS resource changes performed. Retaining a CI verification artifact is not an S3/frontend deployment. |

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
The consolidated guard uses the already-reviewed main policy without adding an
identity framework, new exception or further relaxation.

## Confirmed browser CI failure and correction

[Run 42639093191](https://github.com/Gikeeeeeee/CS361_G06/actions/runs/42639093191)
installed Chromium successfully, then reported **13 failed / 2 passed**. Failures
waited for missing `[data-corridor-id]` elements. Its environment included
`VITE_API_VERSION=v1`; Playwright's web-server configuration did not override it.
`frontend/src/services/api/apiClient.ts` concatenates the full version path with
the API base. The incorrect value produces a malformed URL such as
`http://127.0.0.1:4173v1/buildings`, preventing the mocked campus API from loading.
The unchanged `loads graph` test reproduced the exact missing-element failure
locally with that value. The CI browser step now explicitly uses `/api/v1`.
No application code, browser assertion, timeout or retry policy is changed.

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
| `npm run test:corridors` with `VITE_API_VERSION=/api/v1` | **15 passed**, exit 0 (26.4 seconds), using the existing Chromium executable. Negative reproduction with `v1` failed as expected. All browser tests and assertions are unchanged. |
| Existing `frontend_release.py build` / `verify` | Passed: locked dependency installation, TypeScript compilation, Vite production build and manifest verification using explicit reserved fixtures. Existing >500 kB chunk-size advisory remains. |
| `python scripts/verify_svg_assets.py --build-dir scratch/pr288-consolidated-ci/dist` | Passed: six SVG files, JSON floor-plan references, local public URLs and fresh built copies. No missing or stale files within these checks. |
| `python -m pytest -q scripts/tests -p no:cacheprovider` | **285 passed**, including main's guard/diagnostics, asset checker, retained CD workflow, frontend build/integrity, sandbox utility, smoke and receipt-gated post-deployment tests. All network/deployment cases are mocks. |
| `terraform validate -no-color` in both roots | Backend passed with 14 existing deprecation warnings; frontend passed without warnings. |
| Workflow syntax / `git diff --check` | Actionlint 1.7.12 passed for edited `ci.yml` and `cd.yml` (optional ShellCheck/Pyflakes integrations disabled); diff whitespace check passed. |

## Consolidated GitHub Actions evidence

[Run 42642406031](https://github.com/Gikeeeeeee/CS361_G06/actions/runs/42642406031)
completed with **success** at implementation commit
`579539670da5af85808b7892204b77d0a75fe936` on the existing PR #288 branch.

| Job | Confirmed result |
|---|---|
| Frontend Validation | Lint and SVG loading regressions passed; **15 browser tests passed** in 18.4 seconds; locked isolated production build, manifest verification, **six SVG asset checks** and verification-artifact retention all succeeded. |
| Python Tests | **361 backend tests passed**, 38 live API tests deselected; **285 automation tests passed**. |
| Terraform Validate (terraform-backend) | Formatting, backend-disabled init and validate succeeded. |
| Terraform Validate (terraform-frontend) | Formatting, backend-disabled init and validate succeeded. |

This evidence identifies the tested implementation commit. The documentation-only
follow-up records that run without changing executable files. The PR remains a
draft targeting `V5`; production `CD` is still `disabled_manually`. No workflow
dispatch, AWS deployment, apply, state change or live post-deployment check ran.

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

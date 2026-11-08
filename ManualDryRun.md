# Manual backend Terraform dry run

This branch is based on `origin/main` at `03ffff6`. It is intended for a separate
review targeting main, not a merge of PR #288. No workflow was executed and no
AWS/state operation was performed while preparing it.

`.github/workflows/backend-dry-run.yml` supports only `workflow_dispatch` and
only executes its job for `refs/heads/main`. It shares the existing Terraform
concurrency group without cancelling production jobs. It reuses existing AWS
Secret references, `TF_VARS_FILE`, committed backend and default workspace.
No target input, new state or resource identity is introduced.

The workflow prepares the existing Linux Lambda archive locally before AWS
authentication so a cold checkout has the archive source directory required by
Terraform. This reuses `build.py`; it does not run a provisioner or deploy the
ZIP. Docker/dependency availability, unpinned transitive packages and artifact
compatibility remain limitations. A package/hash change is blocked by the guard
until compatible deployment evidence exists; it is not automatically accepted.

Only init/validate/plan and inspection are possible. Plan uses `-lock=false` to
avoid lock writes; exit 0/2 proceed to the guard, other exits fail. Snapshots can
become stale and are never approved for apply. Existing-state/account/region
checks reject missing/conflicting evidence, AWS creates/deletes/replacements,
known async-import deletes and Lambda environment/artifact changes. The local
packaging helper is classified separately under narrow ownership/hash checks.
Guard runtime dependencies are stdlib-only `deployment_guard.py` and
`sandbox_validation.py`, copied exactly from PR #288 at `e4ffe1d`. Pytest is needed only for offline
tests, not to execute the workflow. No frontend or post-deployment checks run.
Sanitized summary/cleanup never upload plans, state, credentials or tfvars.

## Production integration boundary

Existing `.github/workflows/cd.yml`, CI, application code and Terraform sources
are byte-equivalent to the base after Git line-ending normalization. Pushing
this feature branch does not trigger production CD. No new PR is opened here.

**Do not merge or run this branch automatically.** GitHub must see the new
manual workflow on the default branch before it is available. The existing
production CD still reacts to *any* main push, so merging even a workflow-only
PR could trigger it. An owner-approved installation plan must prevent that
production execution without silently changing production behavior. This task
does not alter default-branch settings or implement a skip/disable workaround.
Keep this PR preparation separate from PR #288 and obtain explicit review.

## Local checks

```text
python -m pytest -q scripts/tests/test_deployment_guard.py scripts/tests/test_manual_backend_dry_run.py -p no:cacheprovider
actionlint -shellcheck= -pyflakes= .github/workflows/backend-dry-run.yml
git diff --check
```

Focused tests: **56 passed**. Actionlint 1.7.12 passes (optional external
ShellCheck/Pyflakes disabled); `git diff --check` passes. Existing production
CD/CI, application and Terraform match `origin/main`. Copied runtime guards
match the validated PR #288 implementation. No real remote plan or manual run
is proven by local fixtures. Effective IAM/read access, state ownership at run
time, current drift and Lambda package compatibility require authorized AWS
evidence. No actual apply/destroy, S3 write, invalidation, notification or state
repair is provided or permitted.

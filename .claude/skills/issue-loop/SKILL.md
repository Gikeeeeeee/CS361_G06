---
name: issue-loop
description: Review → decide → update architecture diagram → implement → test → live test on sandbox → PR to V4, for one or more GitHub issues. Use when the user runs /issue-loop <issue numbers> or asks to work through a batch of issues.
---

# issue-loop

Args: one or more issue numbers, e.g. `/issue-loop 245 246 250`.
Follow CLAUDE.md (layering, conventions, testing) throughout. Use `gh` for all GitHub calls.

## Phase A — Review (all issues at once)

1. `gh issue view <n> --comments` for every issue. Read the backend code each one touches.
2. Write a review for the user, per issue:
   - **Understanding** — what is asked, in one or two lines.
   - **Plan** — files/layers touched, new routes, new error codes.
   - **Reasoning** — why this approach over alternatives.
   - **Open questions / decisions needed.**
   - **Diagram impact** — yes/no and what changes.
   Then across the batch: overlaps, dependencies, recommended order.
3. ⏸ **STOP. Wait for the user to approve or amend.** Do not edit code.
4. For each issue where a decision was made (by the user or agreed in review),
   post it: `gh issue comment <n> --body-file <tmp>` with heading `### Decision` + bullet points + reason.
   Only post decisions; skip issues with nothing new.

## Phase B — Per issue, in the approved order

1. **Branch**: `git fetch origin && git switch -c <type>/<short-slug>-<n> origin/V4`.
2. **Diagram** (only if Diagram impact = yes):
   - Edit `docs/architecture.drawio` (uncompressed mxGraph XML; it is the source of truth).
     `/docs` is gitignored on purpose: diagram files stay local and are never staged or committed.
     Reuse existing cell styles/icons; new cells need unique `id`s; edges reference `source`/`target` ids.
   - If the `drawio` CLI is on PATH, export:
     `drawio -x -f png -e -o "docs/AWS V3 Diagram.drawio.png" docs/architecture.drawio`
     (`-e` embeds the XML so the PNG stays editable). Otherwise tell the user to export from draw.io.
   - Summarise the diagram diff (added/removed/changed nodes and edges) in plain text.
   - ⏸ **STOP. Ask the user to review the diagram** (open the `.drawio` in draw.io / VS Code extension). Wait for approval.
3. **Implement** per the approved plan. Add/adjust tests in `backend/tests` reusing `conftest.py` fakes.
4. **Test**: `cd backend && pytest -q 2>&1 | tee <scratchpad>/pytest-<n>.txt`.
   If anything fails: fix, rerun. If still failing, STOP and report — never open a PR on red.
   Failures that already exist on `origin/V4` don't block, but list them in the PR as pre-existing.
5. **Live test (sandbox stack)**:
   - Add/extend live tests in `backend/tests/integration/test_api_contract.py` (`pytest.mark.api`,
     `api_base_url` fixture). Writes use `throwaway_room` so they clean up after themselves.
   - ⏸ **STOP. Ask the user to deploy this branch to sandbox** (never run apply yourself):
     ```
     cd terraform/terraform-backend
     terraform workspace select -or-create sandbox
     terraform plan -var-file=sandbox.tfvars -out=tfplan
     terraform apply tfplan
     ```
     The first time only, the sandbox table is empty: ask them to run
     `python scripts/copy_dynamodb.py CS361-G06-data-dynamodb CS361-G06-data-dynamodb-sandbox`.
   - After they say deployed:
     `API_BASE_URL=$(terraform output -raw api_endpoint)` (in the sandbox workspace), then
     `DYNAMODB_TABLE_NAME=CS361-G06-data-dynamodb-sandbox pytest -m api -q --api-url $API_BASE_URL | tee <scratchpad>/live-<n>.txt`.
   - Live failures: fix and ask for a redeploy; never open a PR on live red.
   - Sandbox is shared by every branch in the loop; whatever was deployed last wins. That's fine —
     each PR carries the results from its own deploy.
6. **Commit & push**: stage only relevant files (never `terraform.tfvars`, `*.tfstate`, `lambda.zip`).
   Message `<type>: <summary> (#<n>)`. `git push -u origin HEAD`.
7. **PR**: `gh pr create --base V4 --title "<สรุปสั้นๆ> #<n>" --body-file <tmp>`.
   เขียนเป็น**ภาษาไทย กระชับ อ่านจบในไม่กี่วินาที** (สไตล์เดียวกับ PR #250): bullet สั้นๆ,
   ไม่มีย่อหน้ายาว, ศัพท์เทคนิค/ชื่อไฟล์/route ใช้ภาษาอังกฤษได้. หัวข้อไหนไม่มีอะไรให้ตัดทิ้ง.

   ```
   Closes #<n>

   ## ทำอะไร
   - <สิ่งที่เปลี่ยน 1–3 ข้อ>

   ## ตัดสินใจ
   - <เลือก X แทน Y เพราะ ...>

   ## Architecture
   - <เพิ่ม/เปลี่ยน node หรือเส้นอะไร> (ไม่เปลี่ยน → ตัดหัวข้อนี้)

   ## ผลทดสอบ
   - unit: <N passed> (<M failed เดิมจาก search ถ้ามี>)
   - live (sandbox): <N passed> — <ทดสอบอะไร, คาดหวังอะไร, ได้อะไร>
   <details><summary>pytest output</summary>

   ```text
   <summary lines>
   ```
   </details>
   ```

8. Report the PR URL, then move to the next issue (no need to wait for merge).

## Rules
- Never push to V4 or main directly; never merge PRs.
- Never run `terraform apply` yourself, and never target the `default` workspace (that is the team stack).
- If an issue turns out blocked or unclear mid-implementation, comment on it, skip it, and continue.

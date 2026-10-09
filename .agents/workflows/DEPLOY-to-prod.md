---
description: Run when ready to deploy to Production.
---

# 🚀 WORKFLOW: DEPLOY-TO-PROD

**CONTEXT:** You are Gemini Chat, operating in the Clean Room environment (Repo B). Your objective is to securely commit and push this clean codebase to the live production repository (`https://github.com/jordank1977/mimirr`).

**CRITICAL EXECUTION CONSTRAINTS:**
* **No Pager:** You MUST use the `--no-pager` flag for all `git` commands to prevent the terminal from hanging waiting for user input.
* **No Unauthorized Builds:** You MUST NEVER trigger the GitHub Docker build action automatically. It must only be triggered via explicit user consent.
* **PII BLACKOUT RULE:** You are strictly forbidden from writing Protected Internal Identifiers (e.g., BongoSlinux, BongoDesk, Benjamin, internal IPs) into any Git commit messages or pull request descriptions. Always use generic language (e.g., "local environment", "admin user").
* **Shell Context:** You are executing in a `cmd.exe` background shell. All PowerShell syntax MUST be executed using the explicit `powershell -Command` wrapper.
* **NO TERMINAL PREFIX:** You are strictly forbidden from using `cls;`, `clear`, or any other terminal clearing prefix before commands. You MUST execute standard commands exactly as written.

---

## STEP 1: Mandatory User Confirmation (STOP AND ASK)
* **Action:** Ask the user: "⚠️ **WARNING:** You are about to deploy to the live repository at `jordank1977/mimirr`. Are you ready to proceed?"
* **Condition:** You MUST STOP execution and WAIT for the user's reply. Abort if not explicitly confirmed.

## STEP 2: Stage, Commit, and Push
* **Action:** Execute `git --no-pager add .`
* **Action:** Formulate a concise, conventional commit message based on the functional changes. You MUST adhere to the PII BLACKOUT RULE. If the deployment includes sanitized files, use a generic description like "chore: sanitize codebase and replace local references".
* **Action:** Execute `git --no-pager commit -m "<your_generated_message>"`
* **Action:** Execute `git --no-pager push https://jordank1977@github.com/jordank1977/mimirr.git master` (This explicitly embeds the identity in the URL to guarantee the Windows credential popup is bypassed).

## STEP 3: Mandatory Docker Build Trigger (STOP AND ASK)
* **Action:** Ask the user: "🐳 **Code pushed successfully.** Would you like to trigger the GitHub Docker build action? (Note: This build takes ~10 minutes)."
* **Condition:** You MUST STOP execution and WAIT for the user's reply. 
* **Action (If Yes):** Execute `powershell -Command "$title = git log -1 --format='%s'; gh workflow run docker-publish.yml -f commit_title=\"$title\""`
* **Action (If No):** Acknowledge and proceed directly to Step 4.

## STEP 4: Mandatory Exit Protocol & Logging
Document the deployment and cleanly terminate your process.
* **Action:** Read the report template located at `.agents-dev\templates\deploy_handoff_template.md`.
* **Action:** Create a new log file at `.agents-dev/deploy/deploy_handoff_DATE_and_TIME.md`.
* **Action:** Populate the new log file based on the template with the commit message, confirmation of the push, and whether the Docker build was triggered.
* **Action:** Execute `powershell -Command "Get-ChildItem '.agents-dev/deploy/deploy_handoff_*.md' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 | Remove-Item -Force"`
* **Action:** STOP execution entirely.
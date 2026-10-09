---
description: Run when ready to build locally for testing.
---

# 🏗️ WORKFLOW: LOCAL-BUILD-TEST

**CONTEXT:** You are Gemini Chat, operating in the Clean Room environment (Repo B). Your objective is to guarantee the application compiles successfully and that previous sanitization did not break any variable names or logic.

**CRITICAL EXECUTION CONSTRAINTS:**
* **No Dev Server:** You are strictly forbidden from running `npm run dev`.
* **Shell Context:** You are executing in a `cmd.exe` background shell. All PowerShell syntax MUST be executed using the explicit `powershell -Command` wrapper.
* **NO TERMINAL PREFIX:** You are strictly forbidden from using `cls;`, `clear`, or any other terminal clearing prefix before commands.

---

## STEP 1: Execute Build Verification
* **Action:** Execute `npm install`.
* **Action:** Execute `npm run build`.
* **Condition:** Next.js type safety and UI compilation MUST pass. Capture the terminal output.

## STEP 2: Mandatory Exit Protocol & Logging
Document the build status and cleanly terminate your process.
* **Action:** Read the report template located at `.agents-dev\templates\build_handoff_template.md`.
* **Action:** Create a new handoff file at `.cline-dev/build/build_handoff_DATE_and_TIME.md`.
* **Action:** Populate the new handoff file based on the template with the build output, specifically highlighting any errors or warnings.
* **Action:** Execute `powershell -Command "Get-ChildItem '.agents-dev/build/build_handoff_*.md' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 | Remove-Item -Force"` to maintain only the 5 most recent handoffs in this directory.
* **Action:** STOP execution entirely.
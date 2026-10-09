---
description: Run when ready to sanitize the codebase of any PII.
---

# 🧹 WORKFLOW: SANITIZE-CODEBASE

**CONTEXT:** You are Gemini Chat, operating in the Clean Room environment (Repo B). Your objective is to ensure absolutely no Protected Internal Identifiers (PII) from the homelab environment exist in this codebase.

**CRITICAL EXECUTION CONSTRAINTS:**
* **Git Delegation:** You MUST use native Git commands to build your target file list to ensure 100% dynamic compliance with `.gitignore`.
* **Shell Context:** You are executing in a `cmd.exe` background shell. All PowerShell syntax MUST be executed using the explicit `powershell -Command` wrapper.

---

## STEP 1: Git-Powered PII Search
Delegate the exclusion parsing directly to Git to dynamically respect `.gitignore`, while manually protecting the AI workflow directories.

* **Action:** Execute the following command to securely search for PII using PowerShell:
  `powershell -Command "$piiTerms = @('BongoSlinux', 'BongoSarr', 'BongoDesk', '192.168.', '/mnt/storage/mergerfs', 'Benjamin', 'bgross', 'BentleGiant', 'Bongo'); $targetFiles = git ls-files --cached --others --exclude-standard | Where-Object { ($_ -notmatch '^\.agents-dev|^\.agents|^\.julesrules') -and (Test-Path $_ -PathType Leaf) }; $targetFiles | Get-Item | Select-String -Pattern $piiTerms -List -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path"`
* **Condition:** If the terminal output is empty, log "No PII detected" and skip to Step 3.
* **Action:** Perform string replacement ONLY on the specific files identified in the output.

**Mapping Rules:**
* `BongoSlinux` ➔ `linux-node` | `BongoSarr` ➔ `media-server` | `BongoDesk` ➔ `desktop-client`
* `192.168.*` ➔ `127.0.0.1` | `/mnt/storage/mergerfs` ➔ `/var/lib/mimirr/data`
* `Benjamin` | `Ben` | `bgross` ➔ `Mimirr Admin` | `bgross@benjagross.com` ➔ `admin@mimirr.local`
* `BentleGiant` ➔ `Mimirr-Project` | `Bongo` ➔ `admin-user`

## STEP 2: Track Actions
* **Action:** Record modified filenames and original terms scrubbed.

## STEP 3: Mandatory Exit Protocol & Logging
Document the scrub and cleanly terminate your process.
* **Action:** Read `.agents-dev\templates\sanitize_handoff_template.md`.
* **Action:** Create log at `.agents-dev/sanitize/sanitize_handoff_DATE_and_TIME.md`.
* **Action:** Execute `powershell -Command "Get-ChildItem '.agents-dev/sanitize/sanitize_handoff_*.md' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 | Remove-Item -Force"` to maintain only the 5 most recent logs in this directory.
* **Action:** STOP execution entirely.
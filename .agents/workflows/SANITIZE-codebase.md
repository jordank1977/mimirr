---
description: Run when ready to audit and sanitize the codebase (radar baseline, read-only triage handoff, atomic execution).
---

# 🧹 WORKFLOW: SANITIZE-CODEBASE (Harness Audit Protocol)

**CONTEXT:** You are operating in the Clean Room environment. Your objective is to perform a rigorous, deterministic codebase audit and sanitization without introducing regressions or cognitive debt.

**CRITICAL EXECUTION CONSTRAINTS:**
* **On-Demand Execution:** This audit protocol is invoked strictly on demand via `/SANITIZE-codebase`.
* **Zero Source Edits in Discovery:** Phase 1 and Phase 2 are strictly READ-ONLY. No application code may be modified before user review and approval of the handoff report.
* **Dev Isolation:** `.agents-dev/` is strictly local-only and gitignored. It contains developer scratch scripts and environment helpers that are never sanitized or treated as dead repo code.
* **Guarded Git:** Do not run mutating git commands (`commit`, `push`, `reset`, etc.).

---

## PHASE 1: Deterministic Sensor Baseline (Radar)
Establish a deterministic baseline and scan for defects, dead code, bottlenecks, and homelab PII:

1. **Computational Sensors Baseline:**
   - Execute `npx tsc --noEmit` and `npm run lint`.
   - Record any existing type errors or linter warnings.
2. **Dead Code & Export Inspection:**
   - When inspecting for dead exports, unused files, or orphaned dependencies (e.g., via `npx knip` or static code inspection), explicitly account for Next.js framework entry points:
     - `instrumentation.ts` background singletons (`SyncService`, `RequestService`, `onRequestError`, etc.)
     - `app/api/**/route.ts` HTTP route handlers
     - `app/**/page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` App Router conventions
     - Dynamic imports and lazy-loaded modules
   - Never classify live runtime hooks or Next.js conventions as dead code.
3. **Protected Internal Identifiers (PII) Scan:**
   - Scan tracked files and memory files, excluding `.agents-dev/`, using the private terms defined in local `.agents-dev/sanitize-rules.json` (falling back to generic RFC 1918 private IP patterns if the local config is absent):
     ```cmd
     powershell -Command "& { $configFile = '.agents-dev/sanitize-rules.json'; if (Test-Path $configFile) { $config = Get-Content $configFile | ConvertFrom-Json; $piiTerms = $config.piiTerms } else { $piiTerms = @('192.168.', '10.0.', '172.16.') }; $targetFiles = git ls-files --cached --others --exclude-standard | Where-Object { (($_ -notmatch '^\.agents-dev|^\.agents|^\.julesrules') -or ($_ -match '^\.agents/(memory|rules/memory-index)')) -and (Test-Path $_ -PathType Leaf) }; if ($targetFiles) { $targetFiles | Get-Item | Select-String -Pattern $piiTerms -List -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path } }"
     ```
   - If replacements are needed during Phase 3 execution, apply the mapping rules defined in `.agents-dev/sanitize-rules.json`.

---

## PHASE 2: Read-Only Triage & Handoff Artifact (No Source Edits)
Synthesize findings into an actionable audit artifact without touching application code:

1. **Strict Discovery Isolation:** Do NOT modify application code during discovery.
2. **Filter Out Cosmetic Churn:** Discard cosmetic syntax rewrites, personal style nitpicks, or speculative DRY micro-optimizations that increase cognitive debt.
3. **Generate Handoff Report:**
   - Write the report to `.agents-dev/sanitize/sanitize_handoff_YYYY-MM-DD_HH-MM.md`.
   - Maintain file hygiene: retain only the 5 most recent handoff logs in `.agents-dev/sanitize/`:
     ```cmd
     powershell -Command "Get-ChildItem '.agents-dev/sanitize/sanitize_handoff_*.md' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 | Remove-Item -Force"
     ```
   - The report MUST include a prioritized Markdown table with the following schema:

| Location | Category (Dead Code \| Duplication \| Bottleneck \| Type Safety \| PII) | Proposed Change | Blast Radius (File Count) | Cognitive Debt Risk (Low/Med/High) |
| :--- | :--- | :--- | :--- | :--- |
| `path/to/file.ts` | Dead Code | Remove uncalled helper | 1 file | Low |

4. **User Gate:** Stop execution and ask the user in chat which specific items from the table to execute. Do NOT proceed to Phase 3 without explicit approval.

---

## PHASE 3: Atomic, Verified Execution
Execute only the user-approved items in small, verified slices:

1. **Surgical, Atomic Application:**
   - Modify approved files in small, reviewable slices.
   - Preserve public function signatures, `AbortController` (~8s timeout) requirements, and `globalThis` singleton guards.
2. **Sensor Re-Verification:**
   - Verify each slice with `npx tsc --noEmit` and `npm run lint`.
   - If test script validation is needed, write exclusively to `agent-scratch.ts` or `.agents-dev/scripts/scratch.ts` (and remove root test files afterward).
   - Never weaken compiler or linter rules (no `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, or `any` casts).
3. **Completion & Final Summary:**
   - Provide a concise summary of executed changes and verification results in chat.
   - Run `git status` (read-only) to show modified files for manual user staging/committing.
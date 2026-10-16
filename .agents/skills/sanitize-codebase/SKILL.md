---
name: sanitize-codebase
description: >-
  Three-phase codebase audit and sanitization skill for Mimirr. Use when the
  user invokes /sanitize-codebase or asks to audit/sanitize the repository for
  type/build defects, dead code, homelab PII leaks, and governance/memory hygiene.
---

# 🧹 SKILL: SANITIZE-CODEBASE (Harness Audit Protocol)

**CONTEXT:** You are operating in the Clean Room environment. Your objective is to perform a rigorous, deterministic codebase audit and sanitization without introducing regressions or cognitive debt.

**CRITICAL EXECUTION CONSTRAINTS:**
* **On-Demand Execution:** This audit protocol is invoked strictly on demand via `/sanitize-codebase`.
* **Zero Source Edits in Discovery:** Phase 1 and Phase 2 are strictly READ-ONLY. No application code may be modified before user review and approval of the handoff report.
* **Dev Isolation:** `.agents-dev/` is strictly local-only and gitignored. It contains developer scratch scripts and environment helpers that are never sanitized or treated as dead repo code.
* **Guarded Git:** Do not run mutating git commands (`commit`, `push`, `reset`, etc.).

---

## PHASE 1: Deterministic Sensor Baseline (Radar)
Establish a deterministic baseline and scan for defects, dead code, bottlenecks, homelab PII, and governance drift:

1. **Computational Sensors Baseline:**
   - Execute `npx tsc --noEmit` (sandboxed) and `npm run build` with `BypassSandbox: true` (per `.agents/memory/feedback-sandbox-verification.md`; do not run standalone `npm run lint` sandboxed).
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
     ```powershell
     $configFile = '.agents-dev/sanitize-rules.json'; if (Test-Path $configFile) { $config = Get-Content $configFile | ConvertFrom-Json; $piiTerms = $config.piiTerms } else { $piiTerms = @('192.168.', '10.0.', '172.16.') }; $targetFiles = git ls-files --cached --others --exclude-standard | Where-Object { (($_ -notmatch '^\.agents-dev|^\.agents|^\.julesrules') -or ($_ -match '^\.agents/(memory|rules/memory-index)')) -and (Test-Path $_ -PathType Leaf) }; if ($targetFiles) { $targetFiles | Get-Item | Select-String -Pattern $piiTerms -List -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path }
     ```
   - If replacements are needed during Phase 3 execution, apply the mapping rules defined in `.agents-dev/sanitize-rules.json`.
4. **Governance, Skill & Memory Hygiene Audit:**
   - Verify `.agents/rules/*.md` files are `< 24 KB`.
   - Verify `.agents/skills/*/SKILL.md` files contain valid YAML frontmatter (`name` matching parent folder in lowercase-hyphenated format, plus `description`) and no legacy `.agents/workflows/` files remain.
   - Verify all pointer lines in `.agents/rules/memory-index.md` are `< 150` characters, contain no raw facts, and resolve to valid file paths.
   - Verify all topic files in `.agents/memory/*.md` are `< 10 KB` and contain valid YAML frontmatter (`name`, `description`, `metadata.type`).
   - Verify no 100%-completed plans remain unarchived in `.agents-dev/plans/` and no leftover `agent-scratch.*` files exist at the repo root.

---

## PHASE 2: Read-Only Triage & Handoff Artifact (No Source Edits)
Synthesize findings into an actionable audit artifact without touching application code:

1. **Strict Discovery Isolation:** Do NOT modify application code during discovery.
2. **Filter Out Cosmetic Churn:** Discard cosmetic syntax rewrites, personal style nitpicks, or speculative DRY micro-optimizations that increase cognitive debt.
3. **Generate Handoff Report:**
   - Write the report to `.agents-dev/sanitize/sanitize_handoff_YYYY-MM-DD_HH-MM.md`.
   - Maintain file hygiene: retain only the 5 most recent handoff logs in `.agents-dev/sanitize/`:
     ```powershell
     Get-ChildItem '.agents-dev/sanitize/sanitize_handoff_*.md' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 | Remove-Item -Force
     ```
   - The report MUST include a prioritized Markdown table with the following schema:

| Location | Category (Dead Code \| Duplication \| Bottleneck \| Type Safety \| PII \| Governance) | Proposed Change | Blast Radius (File Count) | Cognitive Debt Risk (Low/Med/High) |
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
   - Verify each slice with `npx tsc --noEmit` (sandboxed) and `npm run build` (`BypassSandbox: true`).
   - If test script validation is needed, write exclusively to `agent-scratch.ts` or `.agents-dev/scripts/scratch.ts` (and remove root test files afterward).
   - Never weaken compiler or linter rules (no `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, or `any` casts).
3. **Completion & Final Summary:**
   - Provide a concise summary of executed changes and verification results in chat.
   - Run `git status` (read-only) to show modified files for manual user staging/committing.

---
description: Interactive workflow to bootstrap agent governance, layered memory, and operational protocols tailored to this project.
---

# 🚀 Agent Governance & Layered Memory Bootstrap Workflow

Establishes a production-grade dual-folder agent governance and layered memory architecture tailored to this repository. Enforces 2026 Harness Engineering principles: Anti-Reward Hacking & Sensor Integrity, Cognitive Debt prevention, real-time memory capture, read-only git safety, decoupled clean-room sanitization, and the Harness Ratchet pattern.

> [!IMPORTANT]
> **Platform Constraint**: All workflow files in `.agents/workflows/` must strictly remain **under 12,000 characters in body text** (Antigravity platform limitation). Keep instructions concise, high-density, and modular.

---

### Step 1: Pre-Flight Workspace Inspection (Silent)
1. Inspect root manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc.) to detect:
   - Language ecosystem, build tools, package manager, and test/lint scripts.
   - Framework entry points & runtime hooks (Next.js, Vite, Fastify, FastAPI, Actix, etc.).
2. Check `.gitignore` and existing `.agents/` or `.agents-dev/` directories.
3. **Idempotency Guard**: If `.agents/` exists, do NOT overwrite established topic files or progress history; only scaffold missing folders and add missing templates.

---

### Step 2: Interactive Discovery Interview (`ask_question`)
Invoke `ask_question` with structured prompts:

* **Q1 (Identity & Architecture):** "What is this project, and what are its primary architectural goals?" (Options tailored to detected stack).
* **Q2 (Verification Sensors):** "What are the primary one-shot build, typecheck, or test commands for verifying changes?" (e.g., `npm run build && npx tsc --noEmit`, `cargo test`, `pytest`).
* **Q3 (Protected Resources):** "Which files or resources must the agent NEVER delete, overwrite, or exfiltrate?" (Multi-select: `.env*`, `*.sqlite`, `*.db`, `*.key`, `*.pem`, CI/CD pipelines).
* **Q4 (Scratch Extension):** "What language extension should scratch test scripts use in `.agents-dev/scripts/`?" (e.g., `.ts`, `.py`, `.go`, `.rs`, `.sh`).
* **Q5 (Clean-Room PII Needs):** "Does this project require internal/homelab PII sanitization for clean-room or public repo syncing?"
  - `(Recommended) Yes — scaffold decoupled PII rules in .agents-dev/sanitize-rules.json and generic /SANITIZE-codebase workflow`
  - `No — standard audit workflow only without private PII dictionary`

---

### Step 3: Configure Version Control (`.gitignore`)
1. Ensure `.agents-dev/` is ignored in root `.gitignore`:
   ```gitignore
   # -------------------------------------------------------------------
   # AI / Agent Context
   # -------------------------------------------------------------------
   # .agents/ IS tracked (governance as code). Ephemeral scratchpad stays local:
   .agents-dev/
   ```
2. **Governance as Code**: Verify `.agents/` is NOT ignored. Memory, rules, and workflows must be version-controlled so governance co-evolves with code commits.

---

### Step 4: Scaffold Directory Tree
Create any missing directories:
```
.agents/
  rules/
  memory/
    archive/
    session-logs/
  workflows/
.agents-dev/
  research/
  logs/
  scripts/
  sanitize/
```

---

### Step 5: Synthesize Core Rules (`.agents/rules/`)

#### 1. `.agents/rules/system-rules.md`
Synthesize using interview answers. Must include frontmatter `trigger: always_on` and these 10 core sections:
1. **Scope & Authorizations**: Full development in-scope; boundary is workspace root. Do NOT edit `system-rules.md` or `.agents/workflows/` unless explicitly asked (Exemption: agent updates memory topic files and `memory-index.md` in real time). Follow workflows ONLY on explicit user invocation. **Constraint:** Workflow files in `.agents/workflows/` must strictly remain under 12,000 characters in body text.
2. **Guarded Git (CRITICAL)**: Mutating git commands forbidden (`commit`, `push`, `reset`, `checkout`, `branch`, `merge`, `rebase`, `stash`, `clean`). Read-only inspection encouraged (`git status`, `git diff`, `git check-ignore`, `git log -n`). Commits are 100% manual in IDE. Never touch `.git/` or `.github/`.
3. **Start Orientation**: Read `.agents-dev/active-context.md` and `memory-index.md`; verify `git status`; load only task-relevant topic files.
4. **Terminal Guardrails**: Shell-compatible commands; never touch OS registries, services, global variables, or drivers; protected files: `<list from Q3>` and `.git/`; confirm destructive actions first; prefer project-local package installs.
5. **Security & Timeouts**: Standard auth wrappers on backend routes; never expose plaintext credentials/keys; external network fetches require `AbortController` (~8s timeout); local data stays local.
6. **Sensor Integrity & Anti-Reward Hacking (CRITICAL)**: Strictly forbidden from adding `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, or casting to `any` to force checks to pass. Compiler/linter configs and test assertions are immutable during feature/refactoring work. Fix the logic or report blockers.
7. **Cognitive Debt & Legibility Guardrails**: Prioritize domain legibility and maintainability over aggressive DRY compression, premature abstractions, or speculative micro-optimizations. Respect established patterns; do not invent generic wrappers.
8. **Codebase Cleanliness**: No diagnostic/log markdown in source folders. Scratch exception: temporary verification scripts must exclusively live in and overwrite `.agents-dev/scripts/scratch.<ext>` or `agent-scratch.<ext>` at repo root (cleaned up after execution). Agent state isolated in `.agents/` and `.agents-dev/`. Surgical edits only.
9. **Completion Protocol**: Verify with `<injected verification command>`; output concise summary in chat listing modified files; STOP execution immediately.
10. **Layered Memory Protocol**: Layers 1–7; topic file conventions (`<type>-<slug>.md` with frontmatter and `**Why:**` / `**How to apply:**` lines); memory accuracy rules (Update don't duplicate, Delete what turns out wrong, Code is ground truth, Don't save what git records, Absolute dates only).

#### 2. `.agents/rules/memory-index.md`
Initialize index with `trigger: always_on` frontmatter. Pointers only, max 150 chars/line, zero raw facts:
- Pointers to `system-rules.md`, `feedback-git-safety.md`, `project-current-milestones.md`.
- Active developer context pointers: `active-context.md` and `progress.md` under `.agents-dev/`.

---

### Step 6: Initialize Memory Framework (`.agents/memory/`)
1. **`feedback-git-safety.md`**: Frontmatter (`type: feedback`); mutating git forbidden; read-only git allowed; scratch scripts strictly in `.agents-dev/scripts/scratch.<ext>` or `agent-scratch.<ext>`. Include `**Why:**` and `**How to apply:**`.
2. **`project-current-milestones.md`**: Frontmatter (`type: project`); verified baseline and active target milestone seeded from Q1.
3. **`archive/README.md`**: Tracking table (`Date | Archived File | Reason | Standing Facts Relocated To`).
4. **`session-logs/README.md`**: Overflow protocol for topic files approaching ~10 KB cap.

---

### Step 7: Create End-of-Session Workflow (`.agents/workflows/wrapup.md`)
Write `.agents/workflows/wrapup.md` (must remain <12,000 chars):
1. **Hygiene & Validation Check**: Review diffs via `git status`/`git diff`. Run one-shot validation without weakening compiler/linter rules. Clean leftover processes.
2. **Docs-as-Code**: Update affected documentation (`README.md`, `docs/`) if architecture or configuration changed.
3. **Memory Audit & Harness Ratchet Check**:
   - **Harness Ratchet Check**: Evaluate if any agent mistake, false assumption, or architectural gotcha occurred; if so, immediately record a concise 1–2 line rule in `.agents/memory/feedback-*.md` to permanently prevent recurrence.
   - Update topic files (<10 KB cap); sync pointers in `memory-index.md` (<150 chars/line).
4. **Sync Plans & Prune Context**: Check off completed tasks in `.agents-dev/plan-*.md`. Overwrite `.agents-dev/active-context.md` (< 30 lines) with current state. **Prune resolved tasks and obsolete notes** so active context stays lean and free of contradictory instructions.
5. **Log Progress & Rotate**: Append completed tasks to `.agents-dev/progress.md` (rotate to `progress-archive.md` if > 15 KB). Use `ask_question` to confirm next priorities.
6. **Handoff (Git is Manual)**: Print `git status` of modified files for manual IDE review/staging.

---

### Step 8: Create Audit Workflow & Decoupled PII Registry (If Q5 = Yes)
1. **`.agents-dev/sanitize-rules.json` (Local & Gitignored)**:
   - Scaffold registry for private terms, IP patterns, and replacement mappings:
     ```json
     {
       "piiTerms": ["internal-host", "192.168.", "admin-username"],
       "mappings": { "internal-host": "server-node", "192.168.*": "127.0.0.1", "admin-username": "admin-user" }
     }
     ```
2. **`.agents/workflows/SANITIZE-codebase.md` (Generic & Tracked, <12,000 chars)**:
   - 3-Phase Harness Audit Protocol:
     - **Phase 1 (Radar)**: Run compiler/lint sensors; inspect dead exports accounting for framework entry points (background singletons, route handlers, dynamic imports); run dynamic PII scan reading from `.agents-dev/sanitize-rules.json`.
     - **Phase 2 (Read-Only Triage Table)**: Zero source edits; write `.agents-dev/sanitize/sanitize_handoff_YYYY-MM-DD_HH-MM.md` with prioritized table (`Location`, `Category`, `Proposed Change`, `Blast Radius`, `Cognitive Debt Risk`); pause for explicit user approval.
     - **Phase 3 (Atomic Verified Execution)**: Apply approved items in reviewable slices, preserving public signatures and runtime guards, re-verified with computational sensors.

---

### Step 9: Initialize Local Session Context (`.agents-dev/`)
1. **`active-context.md`**: Initial current state, date, focus, next target milestone, key documents (< 30 lines).
2. **`progress.md`**: Active milestone header + initial session history entry.
3. **`scripts/scratch.<ext>`**: Initial clean test scratchpad.

---

### Step 10: Verification & Clean Handoff
1. Run `git check-ignore -v .agents-dev/` to confirm gitignore is active.
2. Run `git status` to verify `.agents/` files are untracked/ready for staging.
3. Verify zero PII in `.agents/` files.
4. List generated files in chat and remind user to review and stage via IDE Source Control.
5. **STOP execution immediately.** Do NOT run mutating git commands.

---
name: setup-agent-governance
description: >-
  Interactive project-agnostic skill to bootstrap or upgrade an Antigravity
  agent governance harness, 7-layer memory architecture, and operational skills
  (.agents/skills/) tailored to any repository. Use when invoking
  /setup-agent-governance or asking to set up agent rules, memory, and skills.
---

# 🚀 Agent Governance, Layered Memory & Skills Bootstrap (`/setup-agent-governance`)

Establishes a production-grade dual-folder agent governance, 7-layer memory harness, and modular Agent Skills (`.agents/skills/<name>/SKILL.md`) tailored to any repository. Enforces 2026 Harness Engineering principles: Anti-Reward Hacking & Sensor Integrity, Cognitive Debt prevention, Supply-Chain & Sandbox safety, Progressive Disclosure, Guarded Git, decoupled PII sanitization, and the Harness Ratchet pattern.

> [!IMPORTANT]
> **Antigravity Skills Standard (`agentskills.io`)**:
> Legacy `.agents/workflows/*.md` files are deprecated in favor of **Workspace Skills** at `.agents/skills/<name>/SKILL.md`.
> - Every skill folder name `<name>` must be **lowercase alphanumeric with hyphens only** (`[a-z0-9-]`, max 64 chars) and match the `name` field in `SKILL.md` YAML frontmatter.
> - Only `name` and `description` are loaded into context at startup (progressive disclosure); full instructions and optional `scripts/` or `references/` subdirectories load on demand or via `/<name>` slash command invocation.
> - Rules in `.agents/rules/*.md` must remain **under 24 KB** (`24,000` bytes) with a shared `20,000`-token always-on budget.

---

### Step 1: Pre-Flight Workspace & Environment Inspection (Silent)
Silently inspect the repo before prompting the user to infer stack defaults:
1. **Stack & Entrypoints**: Inspect manifests (`package.json`, `pnpm-workspace.yaml`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `*.sln`/`*.csproj`, `Makefile`, `docker-compose.yml`) to detect language, package manager, verification scripts (`build`, `test`, `lint`, `typecheck`, `check`), and framework entry points (Next.js, Vite, FastAPI, Django, Actix, Gin, ASP.NET, CLI binaries, background workers).
2. **OS & Native Shell**: Detect host OS and active harness shell (`pwsh`, `bash`, `zsh`, `cmd`) so generated rules and skills use native shell syntax without wrapper subshells.
3. **Idempotency & Legacy Workflow Detection**:
   - Check `.gitignore`, `.agents/rules/`, `.agents/memory/`, `.agents/skills/`, `.agents/hooks.json`, and `.agents-dev/`.
   - Check if legacy `.agents/workflows/*.md` files exist. If found, plan to migrate them into `.agents/skills/<lowercase-name>/SKILL.md` and remove the deprecated `.agents/workflows/` directory once migrated.
   - Do NOT overwrite existing memory topic files, active plans, or progress history; only scaffold missing folders/templates and upgrade rules/skills as approved.

---

### Step 2: Interactive Discovery Interview (`ask_question`)
Invoke `ask_question` with options dynamically tailored to Step 1 (prefix detected defaults with `(Recommended)`):

* **Q1 (Identity, Architecture & Runtime Invariants):** "What is this project's domain, architecture, and key runtime invariants?"
  - Inferred options: auth wrappers on endpoints, external fetch timeouts (~8s `AbortController` / `context.WithTimeout`), singleton guards for background jobs, external reference repos/test stacks.
* **Q2 (Verification Sensors & Sandbox Behavior):** "Which one-shot commands verify changes, and do any require `BypassSandbox: true`?"
  - Split detected scripts into: (1) **Fast Sandboxed Gate** (`npx tsc --noEmit`, `cargo check`, `pytest`, `go vet`) and (2) **Full Build / Lint Gate** (`npm run build`, `cargo test`, `dotnet build`), noting if full builds/linters (`next build`/`next lint` on Windows, `pnpm` installs) need `BypassSandbox: true`.
* **Q3 (Git Policy & Deterministic Hook Guardrails):** "What version-control policy and deterministic hook enforcement should this repo use?"
  - `(Recommended) Strict Guarded Git (Read-only git for agent; 100% manual IDE commits) + .agents/hooks.json PreToolUse blocker`
  - `Strict Guarded Git (Prompt rules in system-rules.md only, no hooks.json)`
  - `Branch-Isolated Git (Agent may commit on feature branches; never push/merge to main)`
* **Q4 (Protected Files & Supply-Chain Gate):** "Which resources must NEVER be modified, deleted, or exfiltrated?" (Multi-select tailored to repo):
  - `.env*`, local DBs (`*.sqlite`, `*.db`), keys/certs (`*.key`, `*.pem`), CI/CD (`.github/`), plus `(Recommended) Supply-Chain Gate — forbid unapproved package installs or lockfile mutations`.
* **Q5 (Memory Domains & Scratch Extension):** "Which 3–6 architectural domains should seed `memory-index.md`, and what extension should scratch scripts use?"
  - Pre-populate 3–6 domain headings inferred from the repo (`API & Security`, `Database & Schema`, `External Integrations`, `UI & State`, `Logging & Telemetry`) and detected script extension (`.ts`, `.py`, `.rs`, `.go`, `.sh`, `.ps1`).
* **Q6 (Clean-Room PII Sanitization):** "Does this project need a decoupled local PII registry for clean-room or public repo auditing?"
  - `(Recommended) Yes — scaffold gitignored .agents-dev/sanitize-rules.json + 3-Phase /sanitize-codebase skill`
  - `No private PII registry — scaffold /sanitize-codebase skill for code, dead-export, and governance hygiene audits only`

---

### Step 3: Configure Version Control (`.gitignore`)
1. Ensure `.agents-dev/` and root `agent-scratch.*` test files are ignored in root `.gitignore`:
   ```gitignore
   # -------------------------------------------------------------------
   # AI / Agent Context
   # -------------------------------------------------------------------
   # .agents/ IS tracked (governance as code). Ephemeral state & root scratch stay local:
   .agents-dev/
   agent-scratch.*
   ```
2. **Governance as Code**: Verify `.agents/` is NOT ignored so rules, memory, skills, and hooks co-evolve with code commits.

---

### Step 4: Scaffold Directory Tree
Create any missing directories:
```text
.agents/
  rules/
  memory/
    archive/
    session-logs/
  skills/
    wrapup/
    sanitize-codebase/
.agents-dev/
  plans/
    archive/
  research/
  logs/
  scripts/
  sanitize/
```

---

### Step 5: Synthesize Core Rules (`.agents/rules/`) & Optional Hooks

#### 1. `.agents/rules/system-rules.md`
Synthesize using Step 1 & Step 2 answers (`< 24 KB`, `trigger: always_on` frontmatter, 10 project-tailored sections):
1. **Scope & Authorizations**: Full dev in-scope within workspace root. Do NOT edit `system-rules.md` or `.agents/skills/` unless asked (Exemption: real-time updates to `.agents/memory/*.md` and `memory-index.md`). Execute operational skills (`wrapup`, `sanitize-codebase`) ONLY on explicit user invocation (`/wrapup`, `/sanitize-codebase`). Include external reference repos/test stacks from Q1.
2. **Guarded Git (CRITICAL)**: Tailor to Q3 (Default: mutating git `commit`, `push`, `reset`, `checkout`, `branch`, `merge`, `rebase`, `stash`, `clean` forbidden; read-only `status`, `diff`, `check-ignore`, `log -n` encouraged; commits 100% manual in IDE; never touch `.git/` or `.github/`).
3. **Start Orientation**: Read `.agents-dev/active-context.md` and `.agents/rules/memory-index.md`; run `git status`; load only task-relevant topic files from `.agents/memory/`.
4. **Terminal, Sandbox & Supply-Chain Guardrails (CRITICAL)**:
   - *Native Shell & Prefix-Matching*: Write commands directly for `<detected shell>`; avoid wrappers (`powershell -Command`, `eval`, `env`) or `$(...)` that break prefix-matching auto-approval.
   - *Sandbox Execution*: Try commands sandboxed first (`BypassSandbox: false`); follow documented `BypassSandbox: true` exceptions in `.agents/memory/feedback-*.md`.
   - *System & File Protection*: Never touch OS registries, services, global env vars, or protected files (`<list from Q4>` and `.git/`). Confirm destructive actions first.
   - *Supply-Chain Gate*: Never install packages or mutate dependency manifests/lockfiles without explicit user approval.
5. **Security & Architectural Invariants**: Tailor to Q1 & stack (auth wrappers on endpoints, no plaintext secrets/keys returned to clients, timeouts on external fetches, singleton guards on background jobs).
6. **Sensor Integrity & Anti-Reward Hacking (CRITICAL)**: Strictly forbid suppression directives (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `# noqa`, `# type: ignore`, `#[allow(...)]`, `//nolint`, or `any` casts) to silence errors. Compiler/linter configs and test assertions are immutable during feature/refactoring work. Fix logic or report blockers.
7. **Cognitive Debt & Legibility Guardrails**: Prioritize domain legibility and maintainability over aggressive DRY compression, premature abstractions, or speculative micro-optimizations. Respect established repo patterns.
8. **Codebase Cleanliness**: No diagnostic/handoff markdown in source folders. Temporary test scripts must exclusively live in and overwrite `.agents-dev/scripts/scratch.<ext>` or `agent-scratch.<ext>` at repo root (removed after execution). Agent state isolated in `.agents/` and `.agents-dev/`. Surgical edits only.
9. **Completion Protocol**: Verify with Q2's sensor sequence (`<Fast Sandboxed Gate>` then `<Full Build Gate, noting BypassSandbox if required>`); output concise summary in chat; STOP execution immediately without leaving background processes running.
10. **Layered Memory & Progressive Disclosure Protocol**:
    - *Layers 1–7*: L1 (`system-rules.md`, always on, `< 24 KB`), L2 (`memory-index.md`, always on, `< 200` lines / `< 24 KB`), L3 (Topic files `.agents/memory/<type>-<slug>.md`, on demand, `< 10 KB` each), L4 (Conditional/domain rules `.agents/rules/<domain>.md` with `trigger: model_decision` or path-scoped `AGENTS.md`, plus modular Skills `.agents/skills/<name>/SKILL.md` — 0 body tokens until relevant), L5 (Session logs `.agents/memory/session-logs/<slug>-log.md`, search only), L6 (Archive `.agents/memory/archive/` + `README.md`, search only), L7 (Long-form docs `docs/`, `.agents-dev/plans/`, `.agents-dev/research/`, search only).
    - *Topic Conventions*: `user-`, `feedback-`, `project-`, `reference-` prefixes; frontmatter (`name`, `description`, `metadata.type`); `**Why:**` and `**How to apply:**` on `feedback-`/`project-` files.
    - *Accuracy Rules*: Update don't duplicate; delete what turns out wrong; code is ground truth; don't save what git records; absolute dates (`YYYY-MM-DD`) only; portable relative links only (never local workstation `file:///` paths in tracked files); search before asking; zero secrets/PII in memory.

#### 2. `.agents/rules/memory-index.md`
Initialize with `trigger: always_on` frontmatter. Pointers only (`- [Title](path) — hook`), `< 150` chars/line (`⚠` traps, `⭐` core refs), zero raw facts:
- `## Start of Session & Governance`: `system-rules.md`, `feedback-git-safety.md`, and `feedback-sandbox-verification.md` (if applicable).
- Custom domain headings from Q5.
- `## Active Developer Context & Plans (.agents-dev/)`: `active-context.md`, `progress.md`, and active `.agents-dev/plans/plan-*.md`.

#### 3. `.agents/hooks.json` (If Q3 selected Hook Guardrails)
Create `.agents/hooks.json` with a `PreToolUse` matcher on `run_command` checking `toolCall.args.CommandLine` on stdin and outputting `{"decision":"deny","reason":"Guarded Git: mutating git commands are disabled."}` if it matches `git (commit|push|reset|checkout|rebase|merge|stash|clean)`, else `{"decision":"allow"}`.

---

### Step 6: Initialize Memory Framework (`.agents/memory/`)
1. **`feedback-git-safety.md`**: Frontmatter (`type: feedback`); git policy from Q3; scratch paths (`.agents-dev/scripts/scratch.<ext>` or `agent-scratch.<ext>`). Include `**Why:**` and `**How to apply:**`.
2. **`feedback-sandbox-verification.md`** (If Q2 noted sandbox quirks): Document sandboxed vs. `BypassSandbox: true` verification commands and tool traps.
3. **`project-current-milestones.md`**: Frontmatter (`type: project`); verified baseline and initial milestone from Q1 using portable relative links.
4. **`archive/README.md` & `session-logs/README.md`**: Archival tracking table and 10 KB overflow protocol.

---

### Step 7: Create End-of-Session Skill (`.agents/skills/wrapup/SKILL.md`)
Write `.agents/skills/wrapup/SKILL.md` with YAML frontmatter (`name: wrapup` and third-person `description`), tailored to Q1/Q2:
1. **Hygiene & Sensor Validation**: Review `git status`/`git diff`; verify Q1 invariants (logging, auth wrappers, timeouts, singletons); run Q2 verification sequence without weakening rules; kill leftover processes.
2. **Docs-as-Code**: Update affected docs (`README.md`, `docs/`) if endpoints, config, env vars, or schema changed.
3. **Memory Audit & Harness Ratchet**: Record any session mistake, false assumption, or tool/sandbox gotcha in `.agents/memory/feedback-*.md`. Update topic files (`< 10 KB` cap; overflow dated history to `session-logs/<slug>-log.md`); sync `memory-index.md` (`< 150` chars/line, zero raw facts); move retired milestone files to `archive/`.
4. **Sync Plans, Archive Completed Plans & Prune Context**: Check off completed tasks in `.agents-dev/plans/plan-*.md`. Record exact sub-phase status (`Phase X of Y`) in `.agents-dev/active-context.md` (`< 30` lines). When a plan is 100% complete, relocate standing facts to `.agents/memory/reference-*.md` and move the plan to `.agents-dev/plans/archive/`. Prune obsolete notes.
5. **Log Progress, Rotate & Select Next Target**: Append session summary to `.agents-dev/progress.md` (rotate older entries to `.agents-dev/logs/progress-archive.md` if `> 15 KB`). Invoke `ask_question` with the next pending plan phase or 2–4 next milestone options (`(Recommended)` first), and save the selection.
6. **Manual Git Handoff**: Print `git status` of modified files (including `.agents/memory/`, `.agents/rules/`, and `.agents/skills/`) for manual IDE staging.

---

### Step 8: Create Audit Skill & Decoupled PII Registry (`.agents/skills/sanitize-codebase/SKILL.md`)
1. **`.agents-dev/sanitize-rules.json` (If Q6 = Yes; Local & Gitignored)**:
   ```json
   {
     "piiTerms": ["internal-host", "10.0.", "admin-username"],
     "mappings": { "internal-host": "server-node", "10.0.*": "127.0.0.1", "admin-username": "admin-user" }
   }
   ```
2. **`.agents/skills/sanitize-codebase/SKILL.md` (Generic & Tracked, `name: sanitize-codebase`)**:
   - **Phase 1 (Radar Baseline)**: (1) Run Q2 sensors; (2) Inspect dead exports/files while whitelisting Step 1 framework entry points (routes, pages, startup hooks, background singletons, dynamic imports); (3) Run dynamic PII scan reading `.agents-dev/sanitize-rules.json` (fallback to RFC 1918 IPs) across tracked files + `.agents/memory/` + `memory-index.md`, excluding `.agents-dev/`; (4) **Governance, Skill & Memory Hygiene Audit**: verify `.agents/rules/*.md` `< 24 KB`, `.agents/skills/*/SKILL.md` valid `name`/`description` frontmatter (and zero leftover `.agents/workflows/`), `memory-index.md` lines `< 150` chars with valid links, `.agents/memory/*.md` `< 10 KB` with valid frontmatter, no 100%-complete unarchived plans in `.agents-dev/plans/`, and no leftover `agent-scratch.*` files.
   - **Phase 2 (Read-Only Triage Table)**: Zero source edits; discard cosmetic churn; write `.agents-dev/sanitize/sanitize_handoff_YYYY-MM-DD_HH-MM.md` (retaining max 5 reports) with table (`Location | Category | Proposed Change | Blast Radius | Cognitive Debt Risk`); pause for explicit user approval.
   - **Phase 3 (Atomic Execution)**: Apply approved items in small slices preserving public signatures and Q1 invariants; re-verify Q2 sensors without suppression directives; print `git status`.

---

### Step 9: Initialize Local Session Context (`.agents-dev/`) & Clean Up Legacy Workflows
1. **`active-context.md`**: Current state, date (`YYYY-MM-DD`), focus, next target milestone (`Phase X of Y`), and key document links (`< 30` lines).
2. **`progress.md`**: Active milestone header + initial bootstrap session entry.
3. **`scripts/scratch.<ext>`**: Clean test scratchpad matching Q5 extension.
4. **Legacy `.agents/workflows/` Cleanup**: If any legacy `.agents/workflows/*.md` files were migrated to `.agents/skills/<name>/SKILL.md`, remove the old `.agents/workflows/` files and empty directory so git status remains clean.

---

### Step 10: Verification & Clean Handoff
1. Run `git check-ignore -v .agents-dev/ agent-scratch.<ext>` to confirm ignore rules are active.
2. Verify all `.agents/skills/*/SKILL.md` files have valid `name` (matching folder name) and `description` frontmatter, and `.agents/rules/*.md` are `< 24 KB`.
3. Verify zero PII in tracked `.agents/` files, run `git status`, list generated files in chat, and remind user to stage/commit via IDE Source Control.
4. **STOP execution immediately.** Do NOT run mutating git commands.

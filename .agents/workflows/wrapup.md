---
description: Run at the end of a chat session to cleanly close out Mimirr work, verify logging and docs, update local session state, and prepare for the next session.
---

**Run the End-of-Session Protocol:**

1. **Hygiene Check:** Review all code changes made in this session.
   - Ensure any new mechanics, state changes, calculations, API routes, or background jobs are instrumented with the shared logger (`logger` from `lib/utils/logger`). Never use bare `console.log` — it is stripped from production builds.
   - New background jobs should follow the singleton pattern used by `SyncService` in `instrumentation.ts` (globalThis guard against duplicate intervals).
   - Confirm any new or modified Next.js API routes use the `requireAdmin` / `getServerSession` wrapper pattern, and that no plaintext passwords or API keys are returned to the client.
   - External fetches in changed code must keep the ~8s AbortController timeout pattern.
   - If code changed, run one-shot validation: `npm run build`, `npx tsc --noEmit`, `npm run lint`. Fix or report failures in chat.
   - Ensure no dev servers or background processes are left running.
   - Do NOT create diagnostic/log/handoff files inside the repo — report findings in chat only.

2. **Docs-as-Code:** If this session changed structure, endpoints, env vars, schema, config, or deployment behavior, update the affected files to match: `docs/DEPLOYMENT.md`, `docs/GIT_SETUP.md`, `docs/PRODUCTION-READY.md`, and the affected sections of `README.md` (features, env var table, docker-compose snippet, integration points). If the database schema changed, verify migration/push instructions in `docs/GIT_SETUP.md` still hold. Do not rewrite docs the session did not affect.

3. **Memory Audit & Maintenance (.agents/memory/):**
   - **Inventory Session Knowledge**: Determine what architectural facts, user preferences, API behaviors, traps, or runbooks were discovered or verified this session.
   - **Update Topic Files**: Update existing topic files under `.agents/memory/` before creating new ones. Enforce naming (`<type>-<slug>.md`), mandatory frontmatter (`name`, `description`, `metadata.type`), and `**Why:**` / `**How to apply:**` lines for feedback/project files. Never store secret values; use absolute dates only (`YYYY-MM-DD`).
   - **Check 10 KB Cap**: If any topic file exceeds ~10 KB, move older dated history to `.agents/memory/session-logs/<slug>-log.md` and keep only current state, traps, and runbooks in the active topic file.
   - **Update Memory Index**: Ensure `.agents/rules/memory-index.md` has an accurate pointer for any modified or new topic file. Keep pointers strictly under 150 characters per line (`- [Title](../memory/<file>.md) — hook`), with no raw facts in the index.
   - **Archive Retired Work**: If a project milestone or feature is finished or retired, move the file to `.agents/memory/archive/`, remove its pointer line from `memory-index.md`, record it in `archive/README.md`, and ensure standing facts were first copied to an active reference file.

4. **Sync Active Plan Files & Update Active Context (.agents-dev/):**
   - **Update Plan Files (`.agents-dev/plan-*.md`)**: Inspect any active implementation plan files in `.agents-dev/`. Check off (`[x]`) all tasks, validation gates, and Master Progress Tracker phases completed during this session. If architectural decisions or task scopes evolved during implementation, update the remaining phase specifications to reflect current reality.
   - **Update Active Context (`.agents-dev/active-context.md`)**: Overwrite the "Current State" section to describe exactly where we are leaving off today (under one screen of text), and ensure any active `.agents-dev/plan-*.md` file and its next pending phase are linked under "Next Target Milestone" and "Key Documents".

5. **Log Progress & Request Direction (Interactive Modal):** Open `.agents-dev/progress.md` and move today's completed tasks into the historical log. **STOP AND DO NOT FINISH YET.** Evaluate current session state and use the Antigravity `ask_question` tool to present choices in the interactive chat modal:
   - **Interactive Modal via `ask_question`:**
     - **If an active multi-phase plan (`.agents-dev/plan-*.md`) has remaining phases:** Formulate options around the next pending phase(s) in the plan (prefixing the immediate next phase with `(Recommended)`), alongside any alternative priorities.
     - **If a feature/plan was fully completed:** Review `README.md`, `docs/`, and `.agents-dev/` notes. Formulate 2-4 logical next milestones and invoke `ask_question` with these options as selectable items. Prefix the primary suggestion with "(Recommended)".
     - **If stopping mid-task:** Invoke `ask_question` asking to confirm the exact broken state or next immediate priority to record.
   - **Process Response:** Use the user's selected choice from `ask_question` to finalize and save the target in `.agents-dev/active-context.md`, `.agents-dev/progress.md`, `.agents/memory/project-current-milestones.md`, and any relevant `.agents-dev/plan-*.md`.

6. **Handoff (git is manual):** Do not run any git commands, not even read-only. List all files changed this session (including `.agents/memory/`, `.agents/rules/`, and `.agents/workflows/` changes) so I can stage/commit/push via the IDE Source Control UI. Note: `.agents-dev/` is gitignored; repo code and `.agents/` are tracked and will appear in Source Control.

**Guardrails:** Detailed scratch state and implementation plans live only in `.agents-dev/` — never write `active-context.md`, `progress.md`, or `plan-*.md` into `.agents/` or any tracked path. Never read or modify protected files (`.env.local`, `db.sqlite`, `config/db.sqlite`, `config/encryption.key`, `*.key`).
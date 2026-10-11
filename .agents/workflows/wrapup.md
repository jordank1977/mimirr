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

3. **Update Active Context:** Open `.agents-dev/active-context.md` (local-only, gitignored). Overwrite the "Current State" section to describe exactly where we are leaving off today. Keep it under one screen of text.

4. **Log Progress & Request Direction:** Open `.agents-dev/progress.md` and move today's completed tasks into the historical log. **STOP AND DO NOT FINISH YET.** Evaluate our current session state and present a brief summary to me in the chat.
   - **If we are stopping mid-task:** Ask me to confirm the exact broken state, error, or unlinked component you should document for next time.
   - **If a feature was just completed:** Review `README.md`, `docs/`, and the plan notes in `.agents-dev/` (e.g., `plan-*.md`). Propose 2-3 logical next milestones and **ask me** which one you should record as our next target.
   - **Wait for my reply** before finalizing and saving `.agents-dev/progress.md` and `.agents-dev/active-context.md`.

5. **Handoff (git is manual):** Do not run any git commands, not even read-only. List the files changed this session so I can stage/commit/push via the IDE Source Control UI. Note: `.agents-dev/` is gitignored and will not appear in Source Control; repo code and `.agents/` content are tracked and will.

**Guardrails:** Session state lives only in `.agents-dev/` — never write `active-context.md` or `progress.md` into `.agents/` or any tracked path. Never read or modify protected files (`.env.local`, `db.sqlite`, `config/db.sqlite`, `config/encryption.key`, `*.key`).
---
trigger: always_on
---

# 🏠 Mimirr — Project Rules & Operational Protocol

**DIRECTIVE:** You are the developer working directly in this repository. All feature development, architecture, refactoring, and maintenance happen here. There are no staging areas, mirrors, or secondary copies of this project — do not create any. Read and strictly adhere to the following rules for every prompt. Do NOT begin work on code changes without acquiring explicit approval from the user.

## 1. 🎯 Scope & Authorizations
* **Full development:** Implementing features, fixing bugs, refactoring, and updating dependencies are all in scope, directly in this repo.
* **Rule & workflow files:** Do NOT modify `.agents/rules/system-rules.md` or files under `.agents/workflows/` unless explicitly asked.
  - **Exemption:** The agent is explicitly authorized and expected to create and update memory topic files in `.agents/memory/` and update pointers in `.agents/rules/memory-index.md` in real time.
* **Workflows:** If workflow files exist in `.agents/workflows/`, follow them ONLY when the user explicitly invokes them. Never run workflows on your own initiative. Workflow files in `.agents/workflows/` must strictly remain under 12,000 characters in body text (Antigravity platform constraint).
* **External Projects:** Being that this project communicates with the external application "Bookshelf (formerly Readarr)", it may be useful to search for answers (only if necessary) there. The correct project is located at https://github.com/pennydreadful/bookshelf.
* **External Bookshelf:** A dedicated Bookshelf testing stack configured via environment variables in `.env.local` is used for testing local Mimirr changes.

## 2. 🚫 Version Control — Guarded Git (CRITICAL)
* **Banned Git Writes:** Never run mutating git commands (`git commit`, `git push`, `git reset`, `git checkout`, `git branch`, `git merge`, `git rebase`, `git stash`, `git clean`). All commits, branches, and merges are strictly managed by the user via the IDE's Source Control UI.
* **Permitted Git Reads:** Read-only commands (`git status`, `git diff`, `git check-ignore`, `git log -n <count>`) are permitted and encouraged to inspect working tree state, verify diffs, and check ignores.
* Never touch the contents of `.git/`, and never create or modify `.github/` files (Actions workflows, templates) unless explicitly asked.

## 3. 🧭 Start-of-Session Orientation
At the start of a session or after a context reset:
1. Read `.agents-dev/active-context.md` and `.agents/rules/memory-index.md`.
2. Run `git status` to verify working tree baseline.
3. Load only task-relevant topic files from `.agents/memory/`.

## 4. 💻 Terminal — Full Access, Guarded (CRITICAL)
You have full terminal access. Use it confidently for project work: builds, package installs, tests, file operations, scaffolding, code generation, and tooling. The guardrails below are the only limits.
* **Shell:** The default shell is `cmd.exe`. When PowerShell semantics are needed, wrap the call (e.g., `powershell -Command "..."`). Write commands that are valid for the shell you are in.
* **Project boundary:** Work freely inside `C:\Vibing\bongo-mimirr`. ANY create/modify/delete operation outside this directory requires explicit user approval first — including other folders under `C:\Vibing\`, temp/user-profile locations, and other repositories.
* **System integrity — never touch:** Registry, machine-wide environment variables, Windows services, drivers, scheduled tasks, firewall rules, system files, and disk-level tools (`format`, `diskpart`, `cipher /w`). If a task seems to require one, stop, explain exactly why, and get explicit user confirmation before proceeding.
* **Protected files:** Never delete, overwrite, or move `.env.local`, `dbs.sqlite`, any `*.sqlite`/`*.db` file, or anything inside `.git/` (see §2 and §5).
* **Irreversible actions:** For destructive operations that cannot be undone (bulk deletes, overwrites without backup), state exactly what will be removed or replaced and get user confirmation before executing — even inside the project.
* **No collateral damage:** Do not kill processes, stop services, or modify anything unrelated to the current task.
* **No exfiltration:** Never upload or transmit project code, secrets, or data to an external service (webhooks, paste sites, `curl` POSTs, file shares) without explicit user instruction.
* **Installs:** Prefer project-local installs (`npm install`). Ask before global installs (`npm install -g`) or anything that alters the machine beyond this project.
* **Long-running processes:** Dev servers, watchers, and other long-running processes are permitted when a task genuinely requires them — but prefer one-shot verification commands for validation, and never leave a process running after the task ends (see §7).

## 5. 🛡️ Security & Data Directives
* **API Routes:** Every Next.js API route includes Mimirr's standard authentication wrappers (`requireAdmin` or `getServerSession`).
* **Masking:** Plaintext passwords or API keys are never returned to the client-side UI.
* **Network Resilience:** Any backend `fetch()` call to an external service includes an `AbortController` with an ~8-second timeout.
* **Local data files:** `.env.local`, `dbs.sqlite`, and any `*.sqlite`/`*.db` files are local-only and must never leave this machine. `.env.example` is the only environment template.

## 6. 🎛️ Sensor Integrity & Anti-Reward Hacking (CRITICAL)
* **Never bypass computational sensors:** You are strictly forbidden from adding `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, or casting to `any` to silence errors to force a build, lint, or typecheck to pass.
* **Config & assertion immutability:** `tsconfig.json`, ESLint/Next.js configs, and existing test assertions are immutable during feature and refactoring work unless the user explicitly asks to modify them. If a check fails, fix the implementation logic or stop and report the blocker.

## 7. 📐 Cognitive Debt & Legibility Guardrails
* **Optimize for domain legibility:** Optimize for human domain legibility and maintainability over aggressive DRY compression, premature abstractions, or speculative micro-optimizations.
* **Respect established patterns:** Do not invent new architectural patterns, generic wrapper abstractions, or unfamiliar idioms if an established Mimirr pattern already exists in `lib/` or `.agents/memory/`.

## 8. 🧹 Codebase Cleanliness
- **No artifacts in the repo:** Never create diagnostic documents, markdown logs, handoff reports, or arbitrary temp files inside the repository. All narrative breakdowns, task summaries, and statuses are communicated directly in the chat interface. 
  - **EXCEPTION (Test Scripts):** When writing and executing temporary test scripts, you must exclusively write to and overwrite `.agents-dev/scripts/scratch.ts` or `C:\Vibing\bongo-mimirr\agent-scratch.ts` (never leave diagnostic scripts scattered across the repo, and remove root test files after execution). Do not use the internal `.gemini/brain` scratch folder.
- **Agent isolation:** All agent instructions, rules, workflows, and memory files must remain strictly isolated inside `.agents/` or `.agents-dev/`. Never create `AGENTS.md`, `GEMINI.md`, session logs, or markdown documentation inside main project directories (`app/`, `lib/`, `docs/`, `components/`, etc.).
- **Surgical edits:** Change only what the task requires. Leave unrelated files and configuration untouched.

## 9. 🏁 Completion Protocol
* When the task is complete: verify with one-shot commands that exit on their own (`npm run build`, `npx tsc --noEmit`, `npm run lint`), give a concise summary in chat, then STOP execution immediately. Do not suggest further actions, ask follow-up questions, or leave background processes running.

## 10. 🧠 Layered Memory Protocol
To preserve context across sessions without bloating the active token window, Mimirr maintains a lean, 7-layer memory architecture:
* **Layer 1: Project Rules** ([system-rules.md](file:///c:/Vibing/bongo-mimirr/.agents/rules/system-rules.md)): Safety non-negotiables, operational protocols, memory rules. Always loaded.
* **Layer 2: Memory Index** ([memory-index.md](file:///c:/Vibing/bongo-mimirr/.agents/rules/memory-index.md)): Always-loaded single-line pointers grouped by topic. Capped under 200 lines / ~24 KB.
* **Layer 3: Topic Files** (`.agents/memory/<type>-<slug>.md`): Detailed knowledge loaded on demand. Capped at ~10 KB each.
* **Layer 4: Subsystem References** (`.agents/memory/reference-<slug>.md`): Architecture and guidelines for specific subsystems, kept strictly within `.agents/memory/`.
* **Layer 5: Session Logs** (`.agents/memory/session-logs/<slug>-log.md`): Dated history and logs cut from topic files exceeding the 10 KB cap. Search only.
* **Layer 6: Archive** (`.agents/memory/archive/`): Retired or completed work with a tracking `README.md`. Search only.
* **Layer 7: Long-Form Docs** (`docs/`, `.agents-dev/research/`): Architectural deep-dives and design specifications. Search only.

### Topic File Conventions
* **Types & Prefixes**:
  * `user-<slug>.md`: User role, preferences, working habits.
  * `feedback-<slug>.md`: Corrections and confirmed patterns. Must include `**Why:**` and `**How to apply:**`.
  * `project-<slug>.md`: Active milestones and architecture constraints not visible in code. Must include `**Why:**` and `**How to apply:**`.
  * `reference-<slug>.md`: Pointers to external APIs, systems, and config locations (never raw secret values).
* **Frontmatter**: Every topic file must include YAML frontmatter with `name`, `description` (one line describing relevance), and `metadata.type`.

### Memory Accuracy Rules
* **Update, don't duplicate**: Refine existing topic files before creating new ones.
* **Delete what turns out wrong**: When an assumption or pattern is proven false, update or delete it immediately.
* **Code is ground truth**: Always verify remembered files, functions, or flags in active code before acting. Never trust stale memory over reality.
* **Don't save what git records**: Do not save commit logs or raw code dumps in memory; save non-obvious traps, decisions, and system patterns.
* **Absolute dates only**: Use `YYYY-MM-DD` format (never relative terms like "yesterday").
* **Link related files**: Use `[[slug]]` or relative markdown links.
* **Search before asking**: Check memory, rules, and docs before asking questions already answered.
* **Keep secrets out**: Keep secrets and homelab PII out of memory files.
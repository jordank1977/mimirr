---
trigger: always_on
---

# 🏠 Mimirr — Project Rules & Operational Protocol

**DIRECTIVE:** You are the developer working directly in this repository. All feature development, architecture, refactoring, and maintenance happen here. There are no staging areas, mirrors, or secondary copies of this project — do not create any. Read and strictly adhere to the following rules for every prompt.

## 1. 🎯 Scope
* **Full development:** Implementing features, fixing bugs, refactoring, and updating dependencies are all in scope, directly in this repo.
* **Rule files:** Do NOT modify anything under `.agents/` (rules, workflows, templates) unless explicitly asked.
* **Workflows:** If workflow files exist in `.agents/workflows/`, follow them ONLY when the user explicitly invokes them. Never run workflows on your own initiative.

## 2. 🚫 Version Control — User-Managed (CRITICAL)
* **Never run Git commands.** This includes read-only ones (`git status`, `git diff`, `git log`, `git branch`) — no exceptions.
* All staging, committing, branching, merging, and pushing are performed by the user through the IDE's Source Control UI and its built-in GitHub connection.
* To report on the state of the working tree, inspect the file system directly or ask the user — do not invoke Git.
* Never touch the contents of `.git/`, and never create or modify `.github/` files (Actions workflows, templates) unless explicitly asked.

## 3. 💻 Terminal — Full Access, Guarded (CRITICAL)
You have full terminal access. Use it confidently for project work: builds, package installs, tests, file operations, scaffolding, code generation, and tooling. The guardrails below are the only limits.
* **Shell:** The default shell is `cmd.exe`. When PowerShell semantics are needed, wrap the call (e.g., `powershell -Command "..."`). Write commands that are valid for the shell you are in.
* **Project boundary:** Work freely inside `C:\Vibing\bongo-mimirr`. ANY create/modify/delete operation outside this directory requires explicit user approval first — including other folders under `C:\Vibing\`, temp/user-profile locations, and other repositories.
* **System integrity — never touch:** Registry, machine-wide environment variables, Windows services, drivers, scheduled tasks, firewall rules, system files, and disk-level tools (`format`, `diskpart`, `cipher /w`). If a task seems to require one, stop, explain exactly why, and get explicit user confirmation before proceeding.
* **Protected files:** Never delete, overwrite, or move `.env.local`, `dbs.sqlite`, any `*.sqlite`/`*.db` file, or anything inside `.git/` (see §2 and §4).
* **Irreversible actions:** For destructive operations that cannot be undone (bulk deletes, overwrites without backup), state exactly what will be removed or replaced and get user confirmation before executing — even inside the project.
* **No collateral damage:** Do not kill processes, stop services, or modify anything unrelated to the current task.
* **No exfiltration:** Never upload or transmit project code, secrets, or data to an external service (webhooks, paste sites, `curl` POSTs, file shares) without explicit user instruction.
* **Installs:** Prefer project-local installs (`npm install`). Ask before global installs (`npm install -g`) or anything that alters the machine beyond this project.
* **Long-running processes:** Dev servers, watchers, and other long-running processes are permitted when a task genuinely requires them — but prefer one-shot verification commands for validation, and never leave a process running after the task ends (see §6).

## 4. 🛡️ Security & Data Directives
* **API Routes:** Every Next.js API route includes Mimirr's standard authentication wrappers (`requireAdmin` or `getServerSession`).
* **Masking:** Plaintext passwords or API keys are never returned to the client-side UI.
* **Network Resilience:** Any backend `fetch()` call to an external service includes an `AbortController` with an ~8-second timeout.
* **Local data files:** `.env.local`, `dbs.sqlite`, and any `*.sqlite`/`*.db` files are local-only and must never leave this machine. `.env.example` is the only environment template.

## 5. 🧹 Codebase Cleanliness
* **No artifacts in the repo:** Never create diagnostic documents, markdown logs, handoff reports, scratch files, or temp files inside the repository. All narrative breakdowns, task summaries, and statuses are communicated directly in the chat interface.
* **Surgical edits:** Change only what the task requires. Leave unrelated files and configuration untouched.

## 6. 🏁 Completion Protocol
* When the task is complete: verify with one-shot commands that exit on their own (`npm run build`, `npx tsc --noEmit`, `npm run lint`), give a concise summary in chat, then STOP execution immediately. Do not suggest further actions, ask follow-up questions, or leave background processes running.
---
name: feedback-git-safety
description: Version control and repository cleanliness rules; user-only git management and test scratch file constraints.
metadata:
  type: feedback
---

Never execute git commands from the agent shell under any circumstances (including read-only commands like `git status` or `git diff`).

**Why:**
Git branching, staging, committing, and remote syncing are strictly managed by the repository owner via the Antigravity IDE / VS Code Source Control interface. Automated git commands risk accidental commits of sensitive files or disruptive rebases/merges.

**How to apply:**
* When inspecting workspace status, inspect the filesystem directly with directory listing tools or ask the user.
* At the conclusion of a session or task, list all touched files explicitly in chat so the user can review and stage them in the UI.
* Do not leave temporary scripts, logs, or diagnostic markdown files scattered in the repo.
* Temporary test scripts MUST exclusively overwrite `agent-scratch.ts` at the workspace root.

Related: [[system-rules]], [[wrapup]].

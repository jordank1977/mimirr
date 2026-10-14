---
name: feedback-git-safety
description: Version control and repository cleanliness rules; user-only git management and test scratch file constraints.
metadata:
  type: feedback
---

Never execute mutating git commands (`commit`, `push`, `reset`, `checkout`, `branch`, `merge`, `rebase`, `stash`, `clean`). Read-only git commands (`git status`, `git diff`, `git check-ignore`, `git log -n <count>`) are permitted and encouraged to inspect working tree state and check ignores.

**Why:**
Git branching, staging, committing, and remote syncing are strictly managed by the repository owner via the Antigravity IDE / VS Code Source Control interface. Automated git write commands risk accidental commits of sensitive files or disruptive rebases/merges. Read-only commands allow rapid, accurate working tree inspection without modifying repository state.

**How to apply:**
* Run read-only git commands (`git status`, `git diff`, `git check-ignore`, `git log -n <count>`) freely to inspect working tree changes, check ignore rules, and report status.
* All commits and branch operations remain 100% manual for the developer via the IDE UI.
* Do not leave temporary scripts, logs, or diagnostic markdown files scattered in the repo.
* Temporary test scripts MUST exclusively live in and overwrite `.agents-dev/scripts/scratch.ts` or `agent-scratch.ts` (repo root, ensuring root test scripts are cleaned up after execution).

Related: [[system-rules]], [[wrapup]].

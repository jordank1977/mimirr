---
name: feedback-sandbox-verification
description: Next.js build/lint fail falsely inside the agent terminal sandbox on Windows; how to verify correctly.
metadata:
  type: feedback
---

Inside the agent terminal sandbox, `next build` / `next lint` fail to detect the installed `typescript` package (5.9.3 resolves fine via `node -e "require.resolve('typescript')"`). Consequences observed 2026-10-14:
* `npm run build` → false `Module not found: Can't resolve '@/lib/utils/logger'` errors (tsconfig `paths` aliases never load; only the first `@/` import per file is reported, so it looks file-specific).
* `npm run lint` → "Installing devDependencies (npm): typescript, @types/react, @types/node" and hangs (no network). Can mutate `package.json` if left running.

`npx tsc --noEmit` and `npx tsx <file>` work normally in the sandbox.

**Why:**
Without this, an agent may misdiagnose a sandbox artifact as a code regression and "fix" working imports, or leave a lint process attempting package installs.

**How to apply:**
* Run `npx tsc --noEmit` sandboxed as the fast type gate.
* Run `npm run build` with `BypassSandbox: true` directly (it includes Next's lint + type validation step). Do not run standalone `npm run lint` sandboxed; if it starts "Installing dependencies", kill it immediately and confirm `git status` shows no `package.json` / lockfile changes.
* The `⚠ Failed to copy traced files ... (main)/page_client-reference-manifest.js` ENOENT warning during standalone trace collection is non-fatal (build exits 0).

Related: [[feedback-git-safety]], [[system-rules]].

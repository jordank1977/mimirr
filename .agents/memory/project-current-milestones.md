---
name: project-current-milestones
description: Active development milestones, completed features, and next session targets.
metadata:
  type: project
---

# Project Milestones & Current State

Updated: 2026-10-12

## Current Verified State
* **Layered Memory Architecture**: Implemented 7-layer memory architecture, memory index, topic files, and path-scoped rules adapted from Fronc's Claude setup.
* **Book ID Search Routing**: Fixed search prefix colons (`work:`, `edition:`) in `readarr.service.ts` to prevent broken encodings.
* **Direct Import**: Added `directAddBookFromSearch` in `bookshelf/books.ts` allowing uncatalogued / low-popularity books to be imported without author catalogue sync dependencies.
* **Cache Self-Healing**: Real-time 404 handling in `bookshelf/books.ts` and automated stale record pruning across `sync.service.ts` and `request.service.ts`.
* **Cleanliness**: Sanitized codebase with 0 PII detected; builds pass cleanly (`npx tsc --noEmit`, `npm run build`).
* **Production State Replication & Cover Audit**: Automated direct container database export via `.agents-dev/scripts/pull-prod-db.ps1`. Verified 100% cover fidelity with Bookshelf.
* **Autonomous Headless Polling**: Integrated `RequestService.targetPollActiveRequests()` into `sync.service.ts` and `instrumentation.ts` so requests are polled and `BookSearch` commands dispatched 24/7 headlessly without requiring open browser sessions.
* **Logging System Overhaul (Phase 1/6 Complete)**: Completed full end-to-end logging audit and authored 6-phase plan (`.agents-dev/plan-logging-system-overhaul.md`). Implemented Phase 1 in `lib/utils/logger.ts` and `instrumentation.ts`: unconditional `globalThis` caching for `requestContext` (`AsyncLocalStorage`) and `pinoLogger` (restoring 100% `reqId` correlation IDs), stripped `os.hostname()` PII via `base: { pid }`, fixed `pino-roll` v4 debug stream naming (`mimirr-debug.1.log`), normalized `Error` objects in `logger.error`, hydrated saved `log_level` from SQLite at startup, and wired Next.js 15 `onRequestError`.

## Active Target Milestone
* **Application Logging System Overhaul — Phases 2 & 3** (`.agents-dev/plan-logging-system-overhaul.md`):
  - **Phase 2 (Next)**: Expand `redactFields` wildcards and add URL query-secret sanitizer (`?apikey=[REDACTED]`) in `lib/utils/logger.ts`, scrub `targetUrl` in `app/api/mediacover/[...path]/route.ts`, and mask plaintext `apiKey` in `GET /api/settings/bookshelf` + UI (`hasApiKey` pattern).
  - **Phase 3 (Next)**: Prevent `/api/logs*` self-pollution in `withLogging` and tune noisy polling log levels (`INFO` -> `DEBUG`).
  - **Phase 4 (Queued)**: Harden `POST /api/logs/client` with Zod validation, payload bounds, and `clientUrl`.
  - **Phase 5 (Queued)**: Upgrade `GET /api/logs/view` with streaming ring buffer (`?tail=500`, `?level=`, `?search=`) and Admin UI toolbar controls.
  - **Phase 6 (Queued)**: End-to-end verification and production build sign-off.

**Why:**
Maintaining a verified milestone baseline allows any agent session to immediately resume work without guessing which features are stable or in-flight.

**How to apply:**
* Always check this file and `active-context.md` before planning new features.
* When a feature completes, update this record and propose the next 2-3 logical targets during `/wrapup`.
* When a major milestone concludes, archive historical milestone files into `archive/` with a link in `archive/README.md`.

Related: [[reference-bookshelf-api]], [[reference-metadata-routing]], [[reference-logging-architecture]].

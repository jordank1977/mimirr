---
name: project-current-milestones
description: Active development milestones, completed features, and next session targets.
metadata:
  type: project
---

# Project Milestones & Current State

Updated: 2026-10-16

## Current Verified State
* **Governance Harness & Skills Migration**: Upgraded repository governance harness to align with 2026 Harness Engineering, Anti-Reward Hacking (sensor immutability, no compiler bypasses), and Cognitive Debt guardrails. Fully migrated legacy `.agents/workflows/` to modular Antigravity Workspace Skills in `.agents/skills/` (`/wrapup`, `/sanitize-codebase`, `/setup-agent-governance`) with progressive disclosure, zero startup token bloat, and `.agents-dev/` context/plan indexing in `memory-index.md`.
* **Requests UI Polish & Bookshelf Profile Badges**: Implemented Bookshelf profile badge denotation (Option A) in the top-right header row alongside `RequestStatusBadge` across `/requests` and `/requests/all`. Enabled card click navigation to `/book/[id]` with `e.stopPropagation()` on action buttons. Enforced dual-ID request and library state resolution in `app/api/books/[id]/route.ts` with multi-user / admin active request parity and pre-selected quality profiles on `/book/[id]`.
* **Layered Memory Architecture**: Implemented 7-layer memory architecture, memory index, topic files, and path-scoped rules adapted from Fronc's Claude setup.
* **Book ID Search Routing**: Fixed search prefix colons (`work:`, `edition:`) in `readarr.service.ts` to prevent broken encodings.
* **Direct Import**: Added `directAddBookFromSearch` in `bookshelf/books.ts` allowing uncatalogued / low-popularity books to be imported without author catalogue sync dependencies.
* **Cache Self-Healing**: Real-time 404 handling in `bookshelf/books.ts` and automated stale record pruning across `sync.service.ts` and `request.service.ts`.
* **Cleanliness**: Sanitized codebase with 0 PII detected; builds pass cleanly (`npx tsc --noEmit`, `npm run build`).
* **Production State Replication & Cover Audit**: Automated direct container database export via `.agents-dev/scripts/pull-prod-db.ps1`. Verified 100% cover fidelity with Bookshelf.
* **Autonomous Headless Polling**: Integrated `RequestService.targetPollActiveRequests()` into `sync.service.ts` and `instrumentation.ts` so requests are polled and `BookSearch` commands dispatched 24/7 headlessly without requiring open browser sessions.
* **Logging System Overhaul (Phase 1–6 Complete, 2026-10-15)**: Full 6-phase overhaul implemented and verified across `lib/utils/logger.ts`, `instrumentation.ts`, `lib/middleware/logging.middleware.ts`, `app/api/logs/**`, `app/(main)/settings/logs/page.tsx`, and telemetry ingest. 100% `reqId` fidelity across route bundles, `base: { pid }` hostname PII removal, multi-depth fast-redact, `sanitizeLogData` query parameter secret masking, Bookshelf `hasApiKey` masking, self-pollution suppression, bounded client telemetry, streaming $O(1)$ ring buffer log viewer with live search/filter UI, and verified Next.js 15 production build.

## Active Target Milestone
* **Author-First Book Addition — Phase 5 of 5 Pending** ([`.agents-dev/plans/plan-author-first-book-addition.md`](../../.agents-dev/plans/plan-author-first-book-addition.md)):
  - Phases 1–4 (metadata propagation, Readarr author services, `BooksAPI.addBook` orchestration, approval route & baseline sync) are complete; **Phase 5 (End-to-End Verification & Build Validation)** is next.
* **Backlog**: Encrypt `bookshelf_api_key` at rest ([`.agents-dev/plans/archive/plan-logging-system-overhaul.md`](../../.agents-dev/plans/archive/plan-logging-system-overhaul.md) §6).

**Why:**
Maintaining a verified milestone baseline allows any agent session to immediately resume work without guessing which features are stable or in-flight.

**How to apply:**
* Always check this file and `active-context.md` before planning new features.
* When a feature completes, update this record and propose the next 2-3 logical targets during `/wrapup`.
* When a major milestone concludes, archive historical milestone files into `archive/` with a link in `archive/README.md`.

Related: [[reference-bookshelf-api]], [[reference-metadata-routing]], [[reference-logging-architecture]].

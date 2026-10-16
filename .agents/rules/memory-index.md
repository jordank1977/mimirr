---
trigger: always_on
---

# 🧠 Mimirr — Memory Index

Pointers only: `- [Title](../memory/<file>.md) — hook`. Max 150 chars/line. Never store raw facts in this index.

## Start of Session & Governance
- [system-rules.md](./system-rules.md) — ⚠ Safety non-negotiables: guarded git, protected files, sensor integrity, user approval
- [feedback-git-safety.md](../memory/feedback-git-safety.md) — ⚠ Read-only git permitted, commits manual in IDE, scratch in .agents-dev/scripts/
- [feedback-sandbox-verification.md](../memory/feedback-sandbox-verification.md) — ⚠ next build/lint break in sandbox; tsc sandboxed, build w/ bypass

## Bookshelf Integration
- [reference-bookshelf-api.md](../memory/reference-bookshelf-api.md) — ⭐ API v1 endpoints, port 8701 stack, 404 self-healing, directAddBook

## Metadata & Search Routing
- [reference-metadata-routing.md](../memory/reference-metadata-routing.md) — ⭐ ID prefixes (work:, edition:), foreignBookId cache matching

## Database & Schema
- [reference-bookshelf-api.md](../memory/reference-bookshelf-api.md) — libraryBooks table sync and 404 deleted book pruning

## API & Security
- [system-rules.md](./system-rules.md) — ⭐ requireAdmin wrapper, ~8s AbortController timeout, no plaintext credentials

## Logging & Telemetry
- [reference-logging-architecture.md](../memory/reference-logging-architecture.md) — ⭐ Pino singleton, reqId, pino-roll v4, secret redaction

## Environment & Testing
- [project-current-milestones.md](../memory/project-current-milestones.md) — Current state, pending milestones, Bookshelf staging environment

## Active Developer Context & Plans (.agents-dev/)
- [active-context.md](../../.agents-dev/active-context.md) — ⚡ Current session state, active target milestone, key documents
- [progress.md](../../.agents-dev/progress.md) — ⚡ Session history, active milestone tracking, completed phase logs
- [plan-author-first-book-addition.md](../../.agents-dev/plans/plan-author-first-book-addition.md) — 📋 Author-first (Phase 5 pending)


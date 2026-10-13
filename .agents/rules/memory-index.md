---
trigger: always_on
---

# 🧠 Mimirr — Memory Index

Pointers only: `- [Title](../memory/<file>.md) — hook`. Max 150 chars/line. Never store raw facts in this index.

## Start of Session
- [system-rules.md](./system-rules.md) — ⚠ Safety non-negotiables: guarded git, protected files, user approval before edits
- [feedback-git-safety.md](../memory/feedback-git-safety.md) — ⚠ Read-only git permitted, commits manual in IDE, scratch in .agents-dev/scripts/

## Bookshelf Integration
- [reference-bookshelf-api.md](../memory/reference-bookshelf-api.md) — ⭐ Bookshelf API v1 endpoints, port 8701 test stack, 404 self-healing, directAddBook

## Metadata & Search Routing
- [reference-metadata-routing.md](../memory/reference-metadata-routing.md) — ⭐ ID prefixes (work:, edition:) preservation, foreignBookId cache matching

## Database & Schema
- [reference-bookshelf-api.md](../memory/reference-bookshelf-api.md) — libraryBooks table sync and 404 deleted book pruning

## API & Security
- [system-rules.md](./system-rules.md) — ⭐ requireAdmin wrapper, ~8s AbortController timeout, no plaintext credentials

## Logging & Telemetry
- [reference-logging-architecture.md](../memory/reference-logging-architecture.md) — ⭐ Pino globalThis singleton, AsyncLocalStorage reqId, pino-roll v4

## Environment & Testing
- [project-current-milestones.md](../memory/project-current-milestones.md) — Current state, pending milestones, Bookshelf staging environment

# Session Logs

This directory contains dated chronological history and detailed conversation logs extracted from active memory topic files.

## Overflow Protocol
* Active topic files under `.agents/memory/` are capped at **~10 KB** to preserve token budget.
* When a topic file approaches or exceeds this limit:
  1. Retain current state, active traps, constraints, and runbooks in the active topic file.
  2. Move older dated entries and changelogs verbatim into `.agents/memory/session-logs/<slug>-log.md`.
  3. Leave a reference link in the topic file pointing to the corresponding log here.
* Files in this directory are search-only and are never automatically loaded at session start.

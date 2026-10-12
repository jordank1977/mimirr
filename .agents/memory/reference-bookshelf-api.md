---
name: reference-bookshelf-api
description: Bookshelf (Readarr) API integration patterns, test instance configuration, 404 self-healing, and direct book additions.
metadata:
  type: reference
---

# Bookshelf (Readarr) Integration

Pointers and architecture rules for communicating with Bookshelf (formerly Readarr).

## Core Integration Points
* **Test Stack**: A dedicated Bookshelf testing stack runs locally/on LAN for verifying Mimirr integrations. The base URL and API key are configured in `.env.local`.
* **Timeout Requirement**: Every backend `fetch()` request to Bookshelf must include an `AbortController` with an ~8-second timeout to prevent request hanging.
* **Singleton Services**: Background sync services (such as `SyncService` in `instrumentation.ts`) must use `globalThis` guards to prevent duplicate interval execution across Next.js reloads.

## Cache Healing & Direct Import Mechanics
* **Direct Add (`directAddBookFromSearch`)**:
  * Implemented in `lib/services/bookshelf/books.ts` (`POST /api/v1/book`).
  * Enables books with low popularity scores (< 50 on standard metadata profiles) to be directly imported and monitored without failing author catalogue sync.
* **404 Self-Healing**:
  * `checkBookInLibrary` in `lib/services/bookshelf/books.ts` intercepts 404 responses from Bookshelf.
  * When a book is deleted directly in Bookshelf, `SyncService.reconcileWithReadarr` and `RequestService.syncReadarrLibrary` prune the stale ID from Mimirr's local `libraryBooks` database.
* **Metadata & Cover Authority**:
  * Bookshelf is the single source of truth for metadata and covers; Mimirr never runs independent third-party scraping.
  * Missing covers (`remoteUrl: "null"` or 404 on `/MediaCover`) render the `📚` placeholder by design.
* **Headless Background Polling**:
  * `RequestService.targetPollActiveRequests` executes autonomously in `instrumentation.ts` (2-min interval) and `SyncService.runBackgroundSync` (15-min interval) so `BookSearch` commands are dispatched without active browser sessions.

Related: [[reference-metadata-routing]], [[feedback-git-safety]].

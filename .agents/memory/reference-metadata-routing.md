---
name: reference-metadata-routing
description: Search ID prefix routing, foreignBookId cache matching, and metadata validation mechanics.
metadata:
  type: reference
---

# Metadata & Search Routing

Architectural patterns for search queries and external book metadata handling.

## Search ID Prefixes
* **Prefix Preservation**:
  * In `lib/services/readarr.service.ts`, colons in ID search prefixes (`work:`, `edition:`, `author:`, etc.) must be preserved directly and never percent-encoded.
  * Percent-encoding colon delimiters breaks upstream Bookshelf search routing for foreign IDs.

## Cache Integrity & Matching
* **Strict Foreign ID Matching**:
  * In `lib/services/book.service.ts` (`getBookById`), avoid blind index selection (e.g. `books[0]`).
  * Enforce strict `foreignBookId` equality to prevent numeric ID cache poisoning across overlapping foreign edition identifiers.
* **Cache Tolerance**:
  * `isCacheValid` is calibrated to tolerate missing optional publisher metadata to avoid unnecessary repeated lookups for established records.

## Request & Details State Resolution
* **Dual-ID Request Matching**:
  * In `app/api/books/[id]/route.ts`, candidate IDs (`id`, `book.foreignBookId`, `foreignId`) match against both `requests.bookId` and `requests.foreignBookId`.
  * Multi-User / Admin Resolution: Check current user's request first, falling back to any active system request so admins on `/requests/all` see the true request state instead of a blank `Unowned` card.
* **Bookshelf Library Match**:
  * Pass `book.foreignBookId || id` to `BookshelfService.checkBookInLibrary`, with local `libraryBooks` SQLite table fallback.

Related: [[reference-bookshelf-api]].

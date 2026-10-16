---
name: reference-logging-architecture
description: Pino v10 logger singleton, AsyncLocalStorage correlation IDs, pino-roll v4 file rotation, and Next.js 15 instrumentation hooks.
metadata:
  type: reference
---

# Logging & Telemetry Architecture

Core architectural mechanics and invariants for Mimirr's server and client logging subsystem (`lib/utils/logger.ts`, `instrumentation.ts`, `lib/middleware/logging.middleware.ts`).

## Global Singleton & Correlation IDs (`reqId`)
* **Unconditional `globalThis` Caching**:
  * Both `requestContext` (`AsyncLocalStorage<{ requestId: string }>`) and `pinoLogger` (`pino.Logger`) in `lib/utils/logger.ts` must be cached unconditionally on `globalThis` (`globalForLogger`).
  * **Trap**: Caching `pinoLogger` without caching `requestContext` on `globalThis` causes Next.js App Router route bundles to create isolated `AsyncLocalStorage` instances while sharing the root `pinoLogger`'s `mixin()`, resulting in `0%` `reqId` attachment in logs.
  * Unconditional caching (including in production standalone builds) also prevents duplicate `pino.transport` worker threads across compiled server chunks.

## PII & Redaction Directives
* **Hostname Stripping**:
  * Default Pino `base` injects `os.hostname()` into every NDJSON record on disk.
  * `pinoConfig` must explicitly set `base: { pid: process.pid }` so host machine names are never written to log files.
* **Error Normalization**:
  * `logger.error(message, data)` normalizes raw `Error` instances and nested `{ error: Error }` / `{ err: Error }` properties via `normalizeErrorPayload()` so stack traces serialize cleanly alongside Pino's `stdSerializers.err`.
* **Key Redaction (`redactFields`)**: fast-redact paths up to `*.*.<key>` depth for `password`, `token`, `apiKey`, plus `accessToken`, `refreshToken`, `passwordHash`, `discordWebhookUrl`, `headers.authorization`, `headers["x-api-key"]`.
* **Query-String Secrets (`sanitizeLogData`)**: fast-redact only matches *keys*. All `logger.*` methods run the message and top-level string props through `sanitizeLogData()`, masking `apikey|api_key|token|access_token|password=` → `[REDACTED]`. **Trap**: nested strings (depth ≥ 2) are NOT scanned — log a query-stripped URL (e.g. MediaCover `safeTargetUrl`) instead of relying on the sanitizer.
* **Secrets to UI**: `GET /api/settings/bookshelf` returns `hasApiKey` only; POST/test fall back to the stored key when `apiKey` is blank (BookLore `hasPassword` pattern). Bookshelf key is still plaintext at rest (backlogged in the logging plan §6).

## File Rotation (`pino-roll` v4)
* **Stream Configuration**:
  * Stream 1 (Standard): `file: path.join(logDir, 'mimirr')`, `extension: '.log'`, `level: 'info'`, `size: '20m'`, `limit: { count: 14 }` -> produces `mimirr.1.log`.
  * Stream 2 (Debug): `file: path.join(logDir, 'mimirr-debug')`, `extension: '.log'`, `level: 'trace'`, `size: '20m'`, `limit: { count: 14 }` -> produces `mimirr-debug.1.log`.
  * **Trap**: Passing `file: path.join(logDir, 'mimirr.debug')` causes `pino-roll` v4 to treat `.debug` as the file extension (`mimirr.1.debug`). Always use a hyphenated stem (`mimirr-debug`) with `extension: '.log'`.

## Next.js 15 Instrumentation (`instrumentation.ts`)
* **Startup Level Hydration**: `register()` queries `settings` for `log_level` on Node.js boot (wrapped in `try/catch` for pre-migration safety) and calls `setLogLevel()`.
* **Unhandled Request Errors**: `onRequestError` is exported from `instrumentation.ts` to capture unhandled App Router render, route handler, server action, and middleware exceptions via `logger.error`.

## Request Logging & Noise Suppression (`withLogging`)
* **`SILENT_PATHS`**: `/api/health`, `/api/logs`, `/api/logs/view`, `/api/logs/client` execute within `requestContext.run` and catch unhandled exceptions, but emit zero `Incoming` or `Completed` log lines to avoid log self-pollution when inspecting logs in the UI.
* **`DEBUG_POLL_PATHS`**: High-frequency polling endpoints (`/api/auth/session`, `/api/setup`, `/api/notifications`, `/api/requests/poll`, `/api/settings/sync-status`, `/api/admin/readarr/scan-status`) emit `Incoming` and `Completed` at `debug` for status `< 400`, and `warn` for `>= 400`.
* **Routine Query Demotions**: Per-item cache/hydration loops and routine cache lookups in `readarr.service.ts` and `bookshelf/books.ts` log at `debug`, reserving `info` for batch summary events and cache purge actions (e.g. 404 deletions).

## Client Telemetry Ingestion (`/api/logs/client`)
* **Bounded Ingestion**: Enforce 16 KB raw payload limit (`413 Payload Too Large`) before JSON parsing; strict Zod schema with `.transform(s => s.slice(...))` to prevent deep React fiber stack traces from causing 400 Bad Request dropouts.
* **Nested Details & Redaction**: `sanitizeLogData()` only scans top-level strings, so nested `details` must have `sanitizeLogData()` run explicitly and nested depth capped at 1 level to stay within Pino's `*.*.<key>` fast-redact paths.
## Bounded Log Viewer API & UI (`/api/logs/view`, `/settings/logs`)
* **Bounded $O(1)$ Memory Storage**: `/api/logs/view` streams NDJSON line-by-line into an $O(1)$ circular ring buffer (`?tail=500`, default 500, max 5000, `tail=0`: unbounded), preventing 20 MB memory spikes during 5-second polling intervals.
* **Early Filtering**: Minimum log level (`?level=debug|info|warn|error`) is evaluated before date formatting or `JSON.stringify()`; substring search (`?search=`) filters lines before ring buffer insertion.
* **Stream Teardown on Windows**: File streams and readline interfaces must close inside a `finally` block (`rl.close(); fileStream.destroy();`) to prevent Windows file handle locking (`EBUSY` / `EPERM`) during active log rotation.
* **Authentication Error Handling**: Catches `AuthError` and returns `handleAuthError(error)` directly so unauthorized access returns `401` or `403` rather than failing into `500`.
* **Coordinated Admin UI Polling**: `/settings/logs` deduplicates initial mount fetches via `Promise.all([fetch('/api/settings/logs'), fetch('/api/logs')])`, silently updates file metadata (`size`, `lastModified`) on background poll, and provides 250ms debounced search, level filtering, tail selection, and pause/resume controls.

Related: [[project-current-milestones]].


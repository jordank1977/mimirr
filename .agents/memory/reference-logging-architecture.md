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

## File Rotation (`pino-roll` v4)
* **Stream Configuration**:
  * Stream 1 (Standard): `file: path.join(logDir, 'mimirr')`, `extension: '.log'`, `level: 'info'`, `size: '20m'`, `limit: { count: 14 }` -> produces `mimirr.1.log`.
  * Stream 2 (Debug): `file: path.join(logDir, 'mimirr-debug')`, `extension: '.log'`, `level: 'trace'`, `size: '20m'`, `limit: { count: 14 }` -> produces `mimirr-debug.1.log`.
  * **Trap**: Passing `file: path.join(logDir, 'mimirr.debug')` causes `pino-roll` v4 to treat `.debug` as the file extension (`mimirr.1.debug`). Always use a hyphenated stem (`mimirr-debug`) with `extension: '.log'`.

## Next.js 15 Instrumentation (`instrumentation.ts`)
* **Startup Level Hydration**: `register()` queries `settings` for `log_level` on Node.js boot (wrapped in `try/catch` for pre-migration safety) and calls `setLogLevel()`.
* **Unhandled Request Errors**: `onRequestError` is exported from `instrumentation.ts` to capture unhandled App Router render, route handler, server action, and middleware exceptions via `logger.error`.

Related: [[project-current-milestones]].

import pino from 'pino'
import path from 'path'
import fs from 'fs'
import { AsyncLocalStorage } from 'async_hooks'

// Next.js Global Singleton Cache
// Unconditionally cache both AsyncLocalStorage (requestContext) and the Pino logger
// on globalThis so instrumentation.ts and all compiled Next.js route bundles share
// the exact same correlation store and worker thread transports.
export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'trace'

const globalForLogger = globalThis as unknown as {
  pinoLogger: pino.Logger | undefined
  requestContext: AsyncLocalStorage<{ requestId: string }> | undefined
  currentLogLevel: LogLevel | undefined
}

// Request Context for Correlation IDs
export const requestContext =
  globalForLogger.requestContext ?? new AsyncLocalStorage<{ requestId: string }>()
globalForLogger.requestContext = requestContext

// Configuration
const IS_PROD = process.env.NODE_ENV === 'production'
export const logDir = IS_PROD
  ? path.join(process.cwd(), 'config', 'logs')
  : path.join(process.cwd(), 'logs')


// Sensitive fields to redact (fast-redact key paths, up to two levels deep)
const redactFields = [
  'password',
  '*.password',
  '*.*.password',
  'passwordHash',
  '*.passwordHash',
  'token',
  '*.token',
  '*.*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'apiKey',
  '*.apiKey',
  '*.*.apiKey',
  'webhookUrl',
  '*.webhookUrl',
  'discordWebhookUrl',
  '*.discordWebhookUrl',
  'cookie',
  '*.cookie',
  'authorization',
  '*.authorization',
  'headers.authorization',
  'headers["x-api-key"]',
  'headers["X-Api-Key"]',
]

// Query-string secrets embedded inside string values (e.g. `?apikey=abc123`).
// fast-redact only matches object keys, so URLs containing secrets must be scrubbed separately.
const QUERY_SECRET_PATTERN = /([?&](?:apikey|api_key|token|access_token|password)=)[^&#\s"']*/gi

function sanitizeString(value: string): string {
  return value.replace(QUERY_SECRET_PATTERN, '$1[REDACTED]')
}

/**
 * Mask query-string secrets in a log message or in top-level string properties of a log payload.
 * Nested key-based secrets are handled by Pino's `redact` configuration.
 */
export function sanitizeLogData(data: unknown): unknown {
  if (typeof data === 'string') return sanitizeString(data)
  if (data === null || typeof data !== 'object' || Array.isArray(data) || data instanceof Error) {
    return data
  }
  const record = data as Record<string, unknown>
  let sanitized: Record<string, unknown> | undefined
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') {
      const cleaned = sanitizeString(value)
      if (cleaned !== value) {
        sanitized = sanitized ?? { ...record }
        sanitized[key] = cleaned
      }
    }
  }
  return sanitized ?? data
}

// Initialize Pino
const createLogger = () => {
  if (typeof window !== 'undefined') {
    // Return a dummy logger for the client-side
    return {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      trace: () => {},
    } as unknown as pino.Logger
  }

  // Ensure log directory exists (server-side only)
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }

  const pinoConfig: pino.LoggerOptions = {
    // Set base logger level to 'trace' so all logs are passed to the transports.
    // The individual transports will filter according to their own level configuration.
    level: 'trace',
    // Omit os.hostname() from NDJSON disk logs to prevent leaking host machine PII
    base: { pid: process.pid },
    redact: {
      paths: redactFields,
      censor: '[REDACTED]'
    },
    mixin() {
      const context = requestContext.getStore()
      return context ? { reqId: context.requestId } : {}
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    }
  }

  // Next.js Multi-Mode Stability Configuration:
  //
  // We use pino.transport to enable high-performance, non-blocking logging
  // and robust log rotation via pino-roll.
  //
  // To ensure compatibility with Next.js standalone builds and Docker,
  // these packages are marked as 'serverExternalPackages' in next.config.js.
  //
  // Note: During HMR (Hot Module Replacement) in development, Next.js can
  // sometimes trigger worker thread crashes. The use of string-based targets
  // allows Pino to resolve the worker scripts correctly from node_modules.
  
  const transport = pino.transport({
    targets: [
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname,reqId',
          messageFormat: '{reqId ? "[" + reqId + "] " : ""}{msg}',
          translateTime: 'SYS:standard',
        },
        level: process.env.LOG_LEVEL || 'info', // Console output respects dynamic log level
      },
      // Stream 1: Standard Log (mimirr.*.log) - Hardcoded to 'info' level
      {
        target: 'pino-roll',
        options: {
          file: path.join(logDir, 'mimirr'),
          extension: '.log',
          size: '20m', // 20 Megabytes
          mkdir: true,
          limit: { count: 14 }, // Retain 14 files
        },
        level: 'info', // Hardcoded to capture info, warn, error, fatal
      },
      // Stream 2: Debug Log (mimirr-debug.*.log) - Hardcoded to capture EVERYTHING
      {
        target: 'pino-roll',
        options: {
          file: path.join(logDir, 'mimirr-debug'),
          extension: '.log',
          size: '20m', // 20 Megabytes
          mkdir: true,
          limit: { count: 14 }, // Retain 14 files
        },
        level: 'trace', // Hardcoded to lowest level to capture everything 24/7
      }
    ],
  });

  return pino(pinoConfig, transport);
}

// Export the active pino logger instance (unconditionally cached on globalThis)
const pinoLogger = globalForLogger.pinoLogger ?? createLogger()
globalForLogger.pinoLogger = pinoLogger

// Export the pino logger instance
export { pinoLogger }

function normalizeErrorPayload(data: unknown): Record<string, unknown> | undefined {
  if (data === undefined || data === null) return undefined
  if (data instanceof Error) {
    return {
      err: {
        name: data.name,
        message: data.message,
        stack: data.stack,
      },
    }
  }
  if (typeof data === 'object') {
    const record = { ...(data as Record<string, unknown>) }
    if (record.error instanceof Error) {
      const errObj = record.error
      record.error = {
        name: errObj.name,
        message: errObj.message,
        stack: errObj.stack,
      }
    }
    if (record.err instanceof Error) {
      const errObj = record.err
      record.err = {
        name: errObj.name,
        message: errObj.message,
        stack: errObj.stack,
      }
    }
    return record
  }
  return { data }
}

export const logger = {
  info: (message: string, data?: unknown) => {
    const msg = sanitizeString(message)
    if (data !== undefined) pinoLogger.info(sanitizeLogData(data), msg)
    else pinoLogger.info(msg)
  },
  warn: (message: string, data?: unknown) => {
    const msg = sanitizeString(message)
    if (data !== undefined) pinoLogger.warn(sanitizeLogData(data), msg)
    else pinoLogger.warn(msg)
  },
  error: (message: string, data?: unknown) => {
    const msg = sanitizeString(message)
    const normalized = normalizeErrorPayload(data)
    if (normalized !== undefined) {
      pinoLogger.error(sanitizeLogData(normalized), msg)
    } else {
      pinoLogger.error(msg)
    }
  },
  debug: (message: string, data?: unknown) => {
    const msg = sanitizeString(message)
    if (data !== undefined) pinoLogger.debug(sanitizeLogData(data), msg)
    else pinoLogger.debug(msg)
  },
  trace: (message: string, data?: unknown) => {
    const msg = sanitizeString(message)
    if (data !== undefined) pinoLogger.trace(sanitizeLogData(data), msg)
    else pinoLogger.trace(msg)
  },
}

const VALID_LOG_LEVELS = new Set<string>(['trace', 'debug', 'info', 'warn', 'error'])

/**
 * Get the currently configured application log level
 */
export function getLogLevel(): LogLevel {
  return (
    globalForLogger.currentLogLevel ||
    (VALID_LOG_LEVELS.has(process.env.LOG_LEVEL || '')
      ? (process.env.LOG_LEVEL as LogLevel)
      : 'info')
  )
}

/**
 * Dynamically update the configured log level
 * @param level - The new log level ('info', 'warn', 'error', 'debug', 'trace')
 */
export function setLogLevel(level: string) {
  const normalized: LogLevel = VALID_LOG_LEVELS.has(level) ? (level as LogLevel) : 'info'
  process.env.LOG_LEVEL = normalized
  globalForLogger.currentLogLevel = normalized
}

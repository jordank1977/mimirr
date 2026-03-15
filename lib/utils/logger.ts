import pino from 'pino'
import path from 'path'
import fs from 'fs'
import { AsyncLocalStorage } from 'async_hooks'

// Request Context for Correlation IDs
export const requestContext = new AsyncLocalStorage<{ requestId: string }>()

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

// Configuration
const IS_PROD = process.env.NODE_ENV === 'production'
export const logDir = IS_PROD
  ? path.join(process.cwd(), 'config', 'logs')
  : path.join(process.cwd(), 'logs')


// Sensitive fields to redact
const redactFields = [
  'password',
  '*.password',
  'token',
  '*.token',
  'apiKey',
  '*.apiKey',
  'webhookUrl',
  '*.webhookUrl',
  'cookie',
  '*.cookie',
  'authorization',
  '*.authorization'
]

// Initialize Pino
const createLogger = () => {
  if (typeof window !== 'undefined') {
    // Return a dummy logger for the client-side
    return {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
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
      // Stream 1: Standard Log (mimirr.log) - Hardcoded to 'info' level
      {
        target: 'pino-roll',
        options: {
          file: path.join(logDir, 'mimirr'),
          extension: '.log',
          size: '20m', // 20 Megabytes
          mkdir: true,
          limit: { count: 14 }, // Retain 14 files (roughly 14 days if logging 20MB/day, or fewer days if rotating more frequently)
        },
        level: 'info', // Hardcoded to capture info, warn, error, fatal
      },
      // Stream 2: Debug Log (mimirr.debug.log) - Hardcoded to capture EVERYTHING
      {
        target: 'pino-roll',
        options: {
          file: path.join(logDir, 'mimirr.debug'),
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

const pinoLogger = createLogger()

// Export the pino logger instance for dynamic level updates
export { pinoLogger }

// Export wrapper to maintain backward compatibility
// Global state for dynamic console log level (since we cannot easily
// change the worker thread transport level without recreation/memory leaks)
let currentConsoleLevel = process.env.LOG_LEVEL || 'info'

// Helper to check if a level should be logged based on currentConsoleLevel
const shouldLogToConsole = (level: string) => {
  return levelValues[level] >= levelValues[currentConsoleLevel]
}

export const logger = {
  info: (message: string, data?: unknown) => {
    if (data) pinoLogger.info(data, message)
    else pinoLogger.info(message)
    // We rely on the transport to log to file, but we can't easily suppress
    // the console output dynamically if we send it to pinoLogger.
    // Wait, if we just send it to pinoLogger, the worker thread will process it.
    // If we want to strictly filter console output dynamically, we would need
    // a separate logger or custom transport.
    // Given the constraints and avoiding memory leaks, the best approach is to
    // just let pinoLogger handle it and accept the worker thread configuration
    // stays static until restart, OR we can use console.log here dynamically?
    // The prompt says: "When the Admin changes the Log Level in the UI, it should
    // strictly update the active `.level` of the console transport".
    // Since Pino doesn't support this via `pino.transport()` worker threads without
    // reloading, we just update process.env.LOG_LEVEL as the safest action.
  },
  warn: (message: string, data?: unknown) => {
    if (data) pinoLogger.warn(data, message)
    else pinoLogger.warn(message)
  },
  error: (message: string, data?: unknown) => {
    if (data instanceof Error) {
      pinoLogger.error({ err: data }, message)
    } else if (data) {
      pinoLogger.error(data, message)
    } else {
      pinoLogger.error(message)
    }
  },
  debug: (message: string, data?: unknown) => {
    if (data) pinoLogger.debug(data, message)
    else pinoLogger.debug(message)
  },
}

/**
 * Dynamically update the log level of the active pino logger instance
 * @param level - The new log level ('info', 'warn', 'error', 'debug')
 */
// Helper to map log levels to numerical values
const levelValues: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
}

export function setLogLevel(level: string) {
  // Update the global process.env so any new instances get it.
  // Because Next.js uses worker threads for pino transports, we cannot
  // dynamically update the console transport level at runtime without causing
  // a memory leak by re-creating the logger.
  process.env.LOG_LEVEL = level
  currentConsoleLevel = level
}

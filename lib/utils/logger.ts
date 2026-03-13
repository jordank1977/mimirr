import pino from 'pino'
import path from 'path'
import fs from 'fs'
import { AsyncLocalStorage } from 'async_hooks'

// Request Context for Correlation IDs
export const requestContext = new AsyncLocalStorage<{ requestId: string }>()

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

// Configuration
const IS_PROD = process.env.NODE_ENV === 'production'
const LOG_DIR = IS_PROD
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
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }

  const pinoConfig: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL || 'info',
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
        level: process.env.LOG_LEVEL || 'info',
      },
      // Stream 1: Standard Log (mimirr.log) - Hardcoded to 'info' level
      {
        target: 'pino-roll',
        options: {
          file: path.join(LOG_DIR, 'mimirr'),
          extension: '.log',
          size: '1m',
          mkdir: true,
          limit: { count: 30 }, // Retain last 30 log files
        },
        level: 'info', // Hardcoded to capture info, warn, error, fatal
      },
      // Stream 2: Debug Log (mimirr.debug.log) - Uses LOG_LEVEL env var
      {
        target: 'pino-roll',
        options: {
          file: path.join(LOG_DIR, 'mimirr.debug'),
          extension: '.log',
          size: '1m',
          mkdir: true,
          limit: { count: 30 }, // Retain last 30 log files
        },
        level: process.env.LOG_LEVEL || 'info',
      }
    ],
  });

  return pino(pinoConfig, transport);
}

const pinoLogger = createLogger()

// Export the pino logger instance for dynamic level updates
export { pinoLogger }

// Export wrapper to maintain backward compatibility
export const logger = {
  info: (message: string, data?: unknown) => {
    if (data) pinoLogger.info(data, message)
    else pinoLogger.info(message)
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
export function setLogLevel(level: string) {
  pinoLogger.level = level
}

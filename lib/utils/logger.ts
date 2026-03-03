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

const LOG_FILE = path.join(LOG_DIR, 'mimirr.log')

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

  // Next.js Dev Mode Hack: Pino transports (which use worker threads) often fail 
  // during hot-reloading in dev mode ("the worker has exited").
  // We use standard streams in dev and full transports in production.
  if (!IS_PROD) {
    return pino(
      pinoConfig,
      pino.multistream([
        { 
          stream: require('pino-pretty')({
            colorize: true,
            ignore: 'pid,hostname,reqId',
            messageFormat: '{reqId ? "[" + reqId + "] " : ""}{msg}',
            translateTime: 'SYS:standard',
          }) 
        },
        { 
          stream: fs.createWriteStream(LOG_FILE, { flags: 'a' }) 
        }
      ])
    )
  }

  // Production: Use high-performance transports with worker threads
  const transports = pino.transport({
    targets: [
      {
        target: 'pino-pretty',
        level: process.env.LOG_LEVEL || 'info',
        options: {
          colorize: true,
          ignore: 'pid,hostname,reqId',
          messageFormat: '{reqId ? "[" + reqId + "] " : ""}{msg}',
          translateTime: 'SYS:standard',
        },
      },
      {
        target: 'pino-roll',
        level: 'debug',
        options: {
          file: LOG_FILE,
          frequency: 'daily',
          size: '10m',
          mkdir: true,
        },
      },
    ],
  })

  return pino(pinoConfig, transports)
}

const pinoLogger = createLogger()

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

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

  // Next.js Multi-Mode Stability Hack: 
  // Pino transports (pino.transport({ targets: [...] })) use Node.js worker threads.
  // Next.js's bundling system (Webpack/Turbo) often fails to include these dynamic
  // worker files in the standalone output, or they crash during HMR in dev mode.
  //
  // To ensure absolute stability in both Dev and Production (Docker), we use 
  // pino.multistream with standard Node.js streams. This bypasses the need for 
  // external worker.js files while still providing high-performance async logging.
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

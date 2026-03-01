import fs from 'fs'
import path from 'path'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogMessage {
  level: LogLevel
  message: string
  timestamp: string
  data?: unknown
}

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'mimirr.log')

// Ensure log directory exists (server-side only)
if (typeof window === 'undefined') {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

function formatLog(log: LogMessage): string {
  const { level, message, timestamp, data } = log
  const replacer = (_key: string, value: unknown) => {
    if (value instanceof Error) {
      return {
        ...value,
        name: value.name,
        message: value.message,
        stack: value.stack,
      }
    }
    return value
  }
  const dataStr = data ? ` | ${JSON.stringify(data, replacer)}` : ''
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`
}

function log(level: LogLevel, message: string, data?: unknown) {
  const logMessage: LogMessage = {
    level,
    message,
    timestamp: new Date().toISOString(),
    data,
  }

  const formatted = formatLog(logMessage)

  // Console output
  switch (level) {
    case 'error':
      console.error(formatted)
      break
    case 'warn':
      console.warn(formatted)
      break
    case 'debug':
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
        console.debug(formatted)
      }
      break
    default:
      console.log(formatted)
  }

  // File output (server-side only)
  if (typeof window === 'undefined') {
    try {
      // We don't filter file logs by level yet because we want a complete record
      // and reading from DB on every log call would be slow.
      // The viewer UI or grep can filter.
      fs.appendFileSync(LOG_FILE, formatted + '\n')
    } catch (err) {
      // Fallback if file writing fails
      console.error('Failed to write to log file', err)
    }
  }
}

export const logger = {
  info: (message: string, data?: unknown) => log('info', message, data),
  warn: (message: string, data?: unknown) => log('warn', message, data),
  error: (message: string, data?: unknown) => log('error', message, data),
  debug: (message: string, data?: unknown) => log('debug', message, data),
}

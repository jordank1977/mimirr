type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogMessage {
  level: LogLevel
  message: string
  timestamp: string
  data?: unknown
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

  switch (level) {
    case 'error':
      console.error(formatted)
      break
    case 'warn':
      console.warn(formatted)
      break
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.debug(formatted)
      }
      break
    default:
      console.log(formatted)
  }
}

export const logger = {
  info: (message: string, data?: unknown) => log('info', message, data),
  warn: (message: string, data?: unknown) => log('warn', message, data),
  error: (message: string, data?: unknown) => log('error', message, data),
  debug: (message: string, data?: unknown) => log('debug', message, data),
}

function extractErrorInfo(data: unknown): { stack?: string; normalizedData?: unknown } {
  if (data instanceof Error) {
    return {
      stack: data.stack?.slice(0, 4000),
      normalizedData: { name: data.name, message: data.message },
    }
  }
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const record = { ...(data as Record<string, unknown>) }
    let extractedStack: string | undefined
    if (record.error instanceof Error) {
      extractedStack = record.error.stack?.slice(0, 4000)
      record.error = { name: record.error.name, message: record.error.message }
    } else if (record.err instanceof Error) {
      extractedStack = record.err.stack?.slice(0, 4000)
      record.err = { name: record.err.name, message: record.err.message }
    } else if (typeof record.stack === 'string') {
      extractedStack = record.stack.slice(0, 4000)
    }
    return { stack: extractedStack, normalizedData: record }
  }
  return { normalizedData: data }
}

export const logToClient = async (
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  data?: unknown
) => {
  try {
    const url =
      typeof window !== 'undefined' ? window.location.pathname.slice(0, 500) : undefined
    const { stack, normalizedData } = extractErrorInfo(data)

    await fetch('/api/logs/client', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      keepalive: true,
      body: JSON.stringify({
        level,
        message: String(message).slice(0, 1000),
        url,
        ...(stack ? { stack } : {}),
        ...(normalizedData !== undefined ? { data: normalizedData } : {}),
      }),
    })
  } catch (err) {
    // Fail silently if telemetry fails to prevent infinite loops or breaking UI
    console.debug('Failed to send client telemetry', err)
  }
}


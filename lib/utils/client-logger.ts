export const logToClient = async (
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  data?: unknown
) => {
  try {
    await fetch('/api/logs/client', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        level,
        message,
        data: data instanceof Error ? { message: data.message, stack: data.stack } : data,
      }),
    });
  } catch (err) {
    // Fail silently if telemetry fails to prevent infinite loops or breaking UI
    console.debug('Failed to send client telemetry', err);
  }
};

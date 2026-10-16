import { NextRequest, NextResponse } from 'next/server'
import { withLogging } from '@/lib/middleware/logging.middleware'
import { logger, sanitizeLogData } from '@/lib/utils/logger'
import { getTokenFromRequest, requireAuth } from '@/lib/middleware/auth.middleware'
import { z } from 'zod'

const MAX_CLIENT_LOG_BYTES = 16_384 // 16 KB

const clientLogSchema = z
  .object({
    level: z.enum(['info', 'warn', 'error', 'debug']).default('info'),
    message: z
      .string()
      .trim()
      .min(1)
      .transform((s) => s.slice(0, 1000)),
    url: z
      .string()
      .transform((s) => s.slice(0, 500))
      .optional(),
    stack: z
      .string()
      .transform((s) => s.slice(0, 4000))
      .optional(),
    data: z.unknown().optional(),
  })
  .strict()

function boundClientDetails(data: unknown): unknown {
  if (data === undefined || data === null) return undefined
  if (typeof data === 'string') {
    return String(sanitizeLogData(data)).slice(0, 2000)
  }
  if (typeof data === 'number' || typeof data === 'boolean') {
    return data
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    const sanitized = sanitizeLogData(data) as Record<string, unknown>
    const bounded: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(sanitized)) {
      if (val !== null && typeof val === 'object') {
        bounded[key] = JSON.stringify(val).slice(0, 1000)
      } else if (typeof val === 'string') {
        bounded[key] = val.slice(0, 2000)
      } else {
        bounded[key] = val
      }
    }
    const serialized = JSON.stringify(bounded)
    if (serialized.length > 4096) {
      return { truncated: serialized.slice(0, 4096) }
    }
    return bounded
  }
  if (Array.isArray(data)) {
    return JSON.stringify(data).slice(0, 2000)
  }
  return undefined
}

async function handler(req: NextRequest) {
  try {
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_CLIENT_LOG_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    const rawText = await req.text()
    if (Buffer.byteLength(rawText, 'utf8') > MAX_CLIENT_LOG_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(rawText)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parseResult = clientLogSchema.safeParse(parsedBody)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid client log payload', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { level, message, url, stack, data } = parseResult.data

    let userId: number | undefined
    if (getTokenFromRequest(req)) {
      try {
        const session = await requireAuth(req)
        userId = session.userId
      } catch {
        // Ignore auth errors for unauthenticated or expired client logs
      }
    }

    const details = boundClientDetails(data)

    const clientPayload: Record<string, unknown> = {
      source: 'client-telemetry',
      ...(url ? { clientUrl: url } : {}),
      ...(userId !== undefined ? { userId } : {}),
      ...(stack ? { stack } : {}),
      ...(details !== undefined ? { details } : {}),
    }

    switch (level) {
      case 'error':
        logger.error(`[CLIENT] ${message}`, clientPayload)
        break
      case 'warn':
        logger.warn(`[CLIENT] ${message}`, clientPayload)
        break
      case 'debug':
        logger.debug(`[CLIENT] ${message}`, clientPayload)
        break
      default:
        logger.info(`[CLIENT] ${message}`, clientPayload)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    // Fail silently with 400 to avoid infinite loops if the telemetry endpoint itself fails
    return NextResponse.json({ success: false }, { status: 400 })
  }
}

export const POST = withLogging(handler)


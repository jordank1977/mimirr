import { NextRequest, NextResponse } from 'next/server'
import { withLogging } from '@/lib/middleware/logging.middleware'
import { logger } from '@/lib/utils/logger'

async function handler(req: NextRequest) {
  try {
    const body = await req.json()
    const { level, message, data, url, stack } = body

    const clientData = {
      ...data,
      clientUrl: url,
      stack: stack,
      source: 'client-telemetry'
    }

    switch (level) {
      case 'error':
        logger.error(`[CLIENT] ${message}`, clientData)
        break
      case 'warn':
        logger.warn(`[CLIENT] ${message}`, clientData)
        break
      case 'debug':
        logger.debug(`[CLIENT] ${message}`, clientData)
        break
      default:
        logger.info(`[CLIENT] ${message}`, clientData)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    // Fail silently to avoid infinite loops if the telemetry endpoint itself fails
    return NextResponse.json({ success: false }, { status: 400 })
  }
}

export const POST = withLogging(handler)

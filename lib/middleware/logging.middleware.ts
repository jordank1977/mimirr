import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { logger, requestContext } from '@/lib/utils/logger'

export type Handler = (req: NextRequest, ...args: any[]) => Promise<NextResponse> | NextResponse

/**
 * Higher-order function to wrap API handlers with logging and request context.
 * This ensures every log generated during the request lifecycle has a correlation ID.
 */
export function withLogging(handler: Handler) {
  return async (req: NextRequest, ...args: any[]) => {
    const requestId = nanoid(10)
    const startTime = Date.now()
    const { method, nextUrl } = req
    const url = nextUrl.pathname

    // Skip logging for health checks to reduce noise
    if (url === '/api/health') {
      return handler(req, ...args)
    }

    // Wrap the handler in the AsyncLocalStorage context
    return requestContext.run({ requestId }, async () => {
      try {
        logger.info(`Incoming ${method} ${url}`)
        
        const response = await handler(req, ...args)
        
        const duration = Date.now() - startTime
        logger.info(`Completed ${method} ${url} - ${response.status} in ${duration}ms`)
        
        return response
      } catch (error) {
        const duration = Date.now() - startTime
        logger.error(`Failed ${method} ${url} after ${duration}ms`, error)
        
        // Re-throw or return a generic error response
        return NextResponse.json(
          { error: 'Internal Server Error', requestId },
          { status: 500 }
        )
      }
    })
  }
}

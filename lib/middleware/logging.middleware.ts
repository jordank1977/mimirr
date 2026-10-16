import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { logger, requestContext } from '@/lib/utils/logger'

export type Handler = (req: NextRequest, ...args: any[]) => Promise<NextResponse> | NextResponse

const SILENT_PATHS = new Set([
  '/api/health',
  '/api/logs',
  '/api/logs/view',
  '/api/logs/client',
])

const DEBUG_POLL_PATHS = new Set([
  '/api/auth/session',
  '/api/setup',
  '/api/notifications',
  '/api/requests/poll',
  '/api/settings/sync-status',
  '/api/admin/readarr/scan-status',
])

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

    const isSilent = SILENT_PATHS.has(url)
    const isDebugPoll = DEBUG_POLL_PATHS.has(url)

    // Wrap the handler in the AsyncLocalStorage context
    return requestContext.run({ requestId }, async () => {
      try {
        if (!isSilent) {
          if (isDebugPoll) {
            logger.debug(`Incoming ${method} ${url}`)
          } else {
            logger.info(`Incoming ${method} ${url}`)
          }
        }
        
        const response = await handler(req, ...args)
        
        if (!isSilent) {
          const duration = Date.now() - startTime
          if (isDebugPoll) {
            if (response.status < 400) {
              logger.debug(`Completed ${method} ${url} - ${response.status} in ${duration}ms`)
            } else {
              logger.warn(`Completed ${method} ${url} - ${response.status} in ${duration}ms`)
            }
          } else {
            if (response.status < 400) {
              logger.info(`Completed ${method} ${url} - ${response.status} in ${duration}ms`)
            } else {
              logger.warn(`Completed ${method} ${url} - ${response.status} in ${duration}ms`)
            }
          }
        }
        
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

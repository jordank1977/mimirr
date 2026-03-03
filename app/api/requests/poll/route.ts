import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { RequestService } from '@/lib/services/request.service'
import { logger } from '@/lib/utils/logger'
import { withLogging } from '@/lib/middleware/logging.middleware'

export const dynamic = 'force-dynamic'

/**
 * POST /api/requests/poll - Poll Bookshelf for status updates
 */
async function pollHandler(request: NextRequest) {
  try {
    // Require authentication (any user can trigger polling)
    const user = await requireAuth(request)

    logger.debug('Polling triggered', { userId: user.userId, role: user.role })

    // Poll all processing requests
    const result = await RequestService.pollProcessingRequests()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    return handleAuthError(error)
  }
}

export const POST = withLogging(pollHandler)

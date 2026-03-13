import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import { RequestService } from '@/lib/services/request.service'
import { logger } from '@/lib/utils/logger'
import { withLogging } from '@/lib/middleware/logging.middleware'

export const dynamic = 'force-dynamic'

/**
 * GET /api/requests/all - Get all requests (admin only)
 */
async function handler(request: NextRequest) {
  try {
    await requireAdmin(request)

    const requests = await RequestService.getAllRequests()

    return NextResponse.json({ requests })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Get all requests API error', { error })
    return NextResponse.json(
      { error: 'Failed to retrieve requests' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(handler)

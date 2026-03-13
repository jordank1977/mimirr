import { NextRequest, NextResponse } from 'next/server'
import { withLogging } from '@/lib/middleware/logging.middleware'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { NotificationService } from '@/lib/services/notification.service'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications - Get user's notifications
 */
async function getHandler(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const notifications = await NotificationService.getUserNotifications(user.userId)

    return NextResponse.json({ notifications })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Failed to get notifications', { error })
    return NextResponse.json(
      { error: 'Failed to get notifications' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler)

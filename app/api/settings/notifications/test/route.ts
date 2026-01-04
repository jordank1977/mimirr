import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import { NotificationService } from '@/lib/services/notification.service'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/settings/notifications/test - Test Discord webhook (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const { webhookUrl } = body

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Webhook URL is required' },
        { status: 400 }
      )
    }

    const success = await NotificationService.testDiscordWebhook(webhookUrl)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to send test notification. Please check your webhook URL.' },
        { status: 500 }
      )
    }

    logger.info('Test Discord notification sent successfully')
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Failed to test Discord webhook', { error })
    return NextResponse.json(
      { error: 'Failed to test Discord webhook' },
      { status: 500 }
    )
  }
}

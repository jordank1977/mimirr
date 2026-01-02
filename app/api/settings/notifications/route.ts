import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import { NotificationService } from '@/lib/services/notification.service'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/settings/notifications - Get notification settings (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const settings = await NotificationService.getSettings()

    if (!settings) {
      // Return default settings if none exist
      return NextResponse.json({
        discordEnabled: false,
        discordWebhookUrl: '',
        discordBotUsername: 'Mimirr',
        discordBotAvatarUrl: '',
        notificationTypes: {
          requestApproved: true,
          requestDeclined: true,
          requestAvailable: true,
          requestSubmitted: true,
          bookshelfError: true,
        },
      })
    }

    // Transform database format to API format
    return NextResponse.json({
      discordEnabled: settings.discordEnabled,
      discordWebhookUrl: settings.discordWebhookUrl || '',
      discordBotUsername: settings.discordBotUsername || 'Mimirr',
      discordBotAvatarUrl: settings.discordBotAvatarUrl || '',
      notificationTypes: {
        requestApproved: settings.notifyRequestApproved,
        requestDeclined: settings.notifyRequestDeclined,
        requestAvailable: settings.notifyRequestAvailable,
        requestSubmitted: settings.notifyRequestSubmitted,
        bookshelfError: settings.notifyBookshelfError,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Failed to get notification settings', { error })
    return NextResponse.json(
      { error: 'Failed to get notification settings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/notifications - Save notification settings (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()

    // Transform API format to database format
    const updateData: any = {
      discordEnabled: body.discordEnabled,
      discordWebhookUrl: body.discordWebhookUrl,
      discordBotUsername: body.discordBotUsername,
      discordBotAvatarUrl: body.discordBotAvatarUrl,
    }

    if (body.notificationTypes) {
      updateData.notifyRequestApproved = body.notificationTypes.requestApproved
      updateData.notifyRequestDeclined = body.notificationTypes.requestDeclined
      updateData.notifyRequestAvailable = body.notificationTypes.requestAvailable
      updateData.notifyRequestSubmitted = body.notificationTypes.requestSubmitted
      updateData.notifyBookshelfError = body.notificationTypes.bookshelfError
    }

    const updated = await NotificationService.updateSettings(updateData)

    logger.info('Notification settings updated', { discordEnabled: body.discordEnabled })

    return NextResponse.json({
      discordEnabled: updated.discordEnabled,
      discordWebhookUrl: updated.discordWebhookUrl || '',
      discordBotUsername: updated.discordBotUsername || 'Mimirr',
      discordBotAvatarUrl: updated.discordBotAvatarUrl || '',
      notificationTypes: {
        requestApproved: updated.notifyRequestApproved,
        requestDeclined: updated.notifyRequestDeclined,
        requestAvailable: updated.notifyRequestAvailable,
        requestSubmitted: updated.notifyRequestSubmitted,
        bookshelfError: updated.notifyBookshelfError,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Failed to save notification settings', { error })
    return NextResponse.json(
      { error: 'Failed to save notification settings' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import { RequestService } from '@/lib/services/request.service'
import { BookService } from '@/lib/services/book.service'
import { BookshelfService } from '@/lib/services/bookshelf.service'
import { NotificationService } from '@/lib/services/notification.service'
import { logger } from '@/lib/utils/logger'
import { db, users, settings } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * POST /api/requests/[id]/decline - Decline a request (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin(request)
    const { id } = await params
    const requestId = parseInt(id)

    // Get the request details
    const existingRequest = await RequestService.getRequestById(requestId)
    if (!existingRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Get book details for notification
    const book = await BookService.getBookById(existingRequest.bookId)

    const updatedRequest = await RequestService.updateRequest(requestId, {
      status: 'declined',
      processedBy: user.userId,
    })

    // Send notification to user if book details available
    if (book) {
      // Get requesting user's details for notification
      const requestingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, existingRequest.userId))
        .limit(1)

      const username = requestingUser[0]?.username || 'Unknown User'

      // Get quality profile name from Bookshelf
      let qualityProfileName = 'Unknown'
      try {
        // Get Bookshelf settings
        const urlSetting = await db
          .select()
          .from(settings)
          .where(eq(settings.key, 'bookshelf_url'))
          .limit(1)

        const apiKeySetting = await db
          .select()
          .from(settings)
          .where(eq(settings.key, 'bookshelf_api_key'))
          .limit(1)

        const bookshelfUrl = urlSetting[0]?.value
        const bookshelfApiKey = apiKeySetting[0]?.value

        if (bookshelfUrl && bookshelfApiKey) {
          const profiles = await BookshelfService.getQualityProfiles({
            url: bookshelfUrl,
            apiKey: bookshelfApiKey,
          })
          const profile = profiles.find((p) => p.id === existingRequest.qualityProfileId)
          if (profile) qualityProfileName = profile.name
        }
      } catch (error) {
        logger.error('Failed to fetch quality profile', { error })
      }

      await NotificationService.sendNotification(
        existingRequest.userId,
        'request_declined',
        'Book Request Declined',
        book.title,
        book.author || 'Unknown Author',
        book.description || 'No description available',
        book.coverImage,
        username,
        'Declined',
        qualityProfileName,
        '/requests'
      )
    }

    return NextResponse.json({ request: updatedRequest })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Decline request API error', { error })
    return NextResponse.json(
      { error: 'Failed to decline request' },
      { status: 500 }
    )
  }
}

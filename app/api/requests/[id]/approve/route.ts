import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import { RequestService } from '@/lib/services/request.service'
import { BookService } from '@/lib/services/book.service'
import { BookshelfService } from '@/lib/services/bookshelf.service'
import { NotificationService } from '@/lib/services/notification.service'
import { db, settings, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/requests/[id]/approve - Approve a request (admin only)
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

    // Get book details
    const book = await BookService.getBookById(existingRequest.bookId)
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

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

    if (!bookshelfUrl || !bookshelfApiKey) {
      logger.warn('Bookshelf not configured, approving request without sending to Bookshelf')
      const updatedRequest = await RequestService.updateRequest(requestId, {
        status: 'approved',
        processedBy: user.userId,
      })
      return NextResponse.json({ request: updatedRequest })
    }

    // Add book to Bookshelf
    logger.info('Adding book to Bookshelf', {
      requestId,
      bookId: book.id,
      title: book.title,
      author: book.author,
      qualityProfileId: existingRequest.qualityProfileId,
    })

    const result = await BookshelfService.addBook(
      {
        url: bookshelfUrl,
        apiKey: bookshelfApiKey,
      },
      {
        title: book.title,
        author: book.author || 'Unknown Author',
        isbn: book.isbn13 || book.isbn,
        monitored: true,
        qualityProfileId: existingRequest.qualityProfileId,
      }
    )

    if (!result.success) {
      logger.error('Failed to add book to Bookshelf', {
        requestId,
        error: result.error,
      })

      // Send notification to admins about Bookshelf error
      const adminIds = await NotificationService.getAdminUserIds()

      // Get requesting user's details
      const requestingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, existingRequest.userId))
        .limit(1)

      const username = requestingUser[0]?.username || 'Unknown User'

      // Get quality profile name from Bookshelf
      let qualityProfileName = 'Unknown'
      try {
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
        adminIds,
        'bookshelf_error',
        'Bookshelf Connection Error',
        book.title,
        book.author || 'Unknown Author',
        `Failed to add to Bookshelf: ${result.error}`,
        book.coverImage,
        username,
        'Error',
        qualityProfileName,
        '/requests/all'
      )

      return NextResponse.json(
        { error: `Failed to add book to Bookshelf: ${result.error}` },
        { status: 500 }
      )
    }

    // Update request with Bookshelf ID and mark as processing
    const updatedRequest = await RequestService.updateRequest(requestId, {
      status: 'processing',
      processedBy: user.userId,
      bookshelfId: result.bookshelfId,
      foreignBookId: result.foreignBookId,
    })

    logger.info('Request approved and sent to Bookshelf', {
      requestId,
      bookshelfId: result.bookshelfId,
    })

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

    // Send notification to user
    await NotificationService.sendNotification(
      existingRequest.userId,
      'request_approved',
      'Book Request Approved',
      book.title,
      book.author || 'Unknown Author',
      book.description || 'No description available',
      book.coverImage,
      username,
      'Approved',
      qualityProfileName,
      '/requests'
    )

    return NextResponse.json({ request: updatedRequest })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Approve request API error', { error })
    return NextResponse.json(
      { error: 'Failed to approve request' },
      { status: 500 }
    )
  }
}

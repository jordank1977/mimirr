import { NextRequest, NextResponse } from 'next/server'
import { withLogging } from '@/lib/middleware/logging.middleware'
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
async function postHandler(
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

    // Hard Stop Safety Guard: Prevent system-imported ghost imports from being manually approved
    const systemUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'system_sync'))
      .limit(1)

    if (systemUser.length > 0 && existingRequest.userId === systemUser[0].id) {
      logger.warn('Attempted to manually approve a system-imported record', { requestId })
      return NextResponse.json(
        { error: 'System-imported records cannot be manually re-approved for push to Readarr.' },
        { status: 400 }
      )
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

    // Determine the initial status based on release date
    const isUnreleased =
      book.publishedDate && new Date(book.publishedDate) > new Date()
    const initialStatus = isUnreleased ? 'approved' : 'processing'

    // Update request status immediately to provide fast UI response and clear errors
    const updatedRequest = await RequestService.updateRequest(requestId, {
      status: initialStatus,
      processedBy: user.userId,
      notes: '', // Cannot use null since type specifies string | undefined for the update partial
    })

    // Process Bookshelf addition in the background
    // We don't 'await' this so the API can respond immediately
    const processBookshelfAddition = async () => {
      try {
        logger.info('Adding book to Bookshelf (background)', {
          requestId,
          bookId: book.id,
          title: book.title,
        })

        // Get root folder path from Bookshelf
        const rootFolders = await BookshelfService.getRootFolders({ 
          url: bookshelfUrl, 
          apiKey: bookshelfApiKey 
        })
        const rootFolderPath = rootFolders.length > 0 ? rootFolders[0].path : ''
        if (!rootFolderPath) {
          throw new Error('No root folder configured in Bookshelf')
        }

        const result = await BookshelfService.addBook(
          {
            url: bookshelfUrl,
            apiKey: bookshelfApiKey,
          },
          {
            title: book.title,
            author: book.author || 'Unknown Author',
            foreignBookId: book.id, // Book ID correlates to the foreign Book ID
            qualityProfileId: existingRequest.qualityProfileId,
            rootFolderPath: rootFolderPath,
          }
        )

        if (!result.success) {
          if (result.requiresManualIntervention) {
            logger.warn('Bookshelf Circuit Breaker Triggered', { requestId, message: result.message })
            
            await RequestService.updateRequest(requestId, {
              status: 'error',
              notes: result.message
            })

            const adminIds = await NotificationService.getAdminUserIds()
            const requestingUser = await db
              .select()
              .from(users)
              .where(eq(users.id, existingRequest.userId))
              .limit(1)
            const username = requestingUser[0]?.username || 'Unknown User'

            await NotificationService.sendNotification(
              adminIds,
              'bookshelf_error',
              'Manual Intervention Required',
              book.title,
              book.author || 'Unknown Author',
              result.message || 'Goodreads metadata conflict detected.',
              book.coverImage,
              username,
              'Error',
              'Unknown',
              '/requests/all'
            )
            return
          }
          throw new Error(result.error)
        }

        // Update request with Bookshelf ID and mark as processing/approved
        await RequestService.updateRequest(requestId, {
          bookshelfId: result.bookshelfId,
          foreignBookId: result.foreignBookId,
        })

        logger.info('Background Bookshelf addition successful', {
          requestId,
          bookshelfId: result.bookshelfId,
        })

        // The Request Transition: Mimirr officially added the book to Readarr.
        // Remove the temporary search cache entry for this foreignBookId.
        const { bookCache } = await import('@/lib/db')
        try {
          await db.delete(bookCache).where(eq(bookCache.id, result.foreignBookId || book.id))
          logger.info('Cleaned up temporary cache for newly added book', { foreignBookId: result.foreignBookId || book.id })
        } catch (cacheErr) {
          logger.error('Failed to clean up temporary cache', { error: cacheErr, foreignBookId: result.foreignBookId || book.id })
        }

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
          const profiles = await BookshelfService.getQualityProfiles({
            url: bookshelfUrl,
            apiKey: bookshelfApiKey,
          })
          const profile = profiles.find(
            (p) => p.id === existingRequest.qualityProfileId
          )
          if (profile) qualityProfileName = profile.name
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
      } catch (error) {
        logger.error('Background Bookshelf addition failed', {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        })

        // Update request status to error
        await RequestService.updateRequest(requestId, {
          status: 'error',
          notes: `Failed to add to Bookshelf: ${error instanceof Error ? error.message : String(error)}`,
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

        await NotificationService.sendNotification(
          adminIds,
          'bookshelf_error',
          'Bookshelf Connection Error',
          book.title,
          book.author || 'Unknown Author',
          `Failed to add to Bookshelf: ${error instanceof Error ? error.message : String(error)}`,
          book.coverImage,
          username,
          'Error',
          'Unknown',
          '/requests/all'
        )
      }
    }

    // Fire and forget the background task
    processBookshelfAddition().catch((err) =>
      logger.error('Unhandled background addition error', { err })
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

export const POST = withLogging(postHandler)

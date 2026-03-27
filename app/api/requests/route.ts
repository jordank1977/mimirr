import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { RequestService } from '@/lib/services/request.service'
import { BookService } from '@/lib/services/book.service'
import { BookshelfService } from '@/lib/services/bookshelf.service'
import { NotificationService } from '@/lib/services/notification.service'
import * as RecommendationService from '@/lib/services/recommendation.service'
import { createRequestSchema, createOnlyThisBookRequestSchema } from '@/lib/utils/validation'
import { logger } from '@/lib/utils/logger'
import { db, users, settings, syncJobs } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { withLogging } from '@/lib/middleware/logging.middleware'

export const dynamic = 'force-dynamic'

/**
 * GET /api/requests - Get user's requests (all requests for admins)
 */
async function getHandler(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // My Requests always shows only the user's own requests, even for admins
    const requests = await RequestService.getRequestsByUserId(user.userId)

    return NextResponse.json({ requests })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Get requests API error', { error })
    return NextResponse.json(
      { error: 'Failed to retrieve requests' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/requests - Create a new request
 */
async function postHandler(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    // Ensure Bookshelf is configured and a sync has completed at least once before allowing requests
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

    const isBookshelfConfigured = urlSetting.length > 0 && apiKeySetting.length > 0 && !!urlSetting[0].value && !!apiKeySetting[0].value

    if (!isBookshelfConfigured) {
      return NextResponse.json(
        { error: 'Bookshelf must be connected before requesting books. Please ask an admin to configure it.' },
        { status: 403 }
      )
    }

    const syncCheck = await db
      .select()
      .from(syncJobs)
      .where(eq(syncJobs.status, 'complete'))
      .limit(1)

    if (syncCheck.length === 0) {
      return NextResponse.json(
        { error: 'Library sync required before requesting books. Please ask an admin to run a scan.' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Check if this is an Only This Book request
    if (body.monitoringOption === 'specificBook') {
      // Validate Only This Book request schema
      const validatedData = createOnlyThisBookRequestSchema.parse(body)
      
      // For Only This Book requests, we'll need to handle the book creation differently
      // This is a simplified implementation - in reality you'd want to create a new book entry
      // and then create the request with that book's ID
      const newRequest = await RequestService.createOnlyThisBookRequest({
        userId: user.userId,
        foreignBookId: validatedData.foreignBookId,
        foreignAuthorId: validatedData.foreignAuthorId,
        title: validatedData.title,
        authorName: validatedData.authorName,
        qualityProfileId: validatedData.qualityProfileId,
        notes: validatedData.notes,
        monitoringOption: 'specificBook'
      })

      // The Request Transition: Mimirr officially added the book to Readarr.
      // Remove the temporary search cache entry for this foreignBookId.
      const { bookCache } = await import('@/lib/db')
      try {
        await db.delete(bookCache).where(eq(bookCache.id, validatedData.foreignBookId))
        logger.info('Cleaned up temporary cache for newly added book', { foreignBookId: validatedData.foreignBookId })
      } catch (cacheErr) {
        logger.error('Failed to clean up temporary cache', { error: cacheErr, foreignBookId: validatedData.foreignBookId })
      }
      
      return NextResponse.json({ request: newRequest }, { status: 201 })
    } else {
      // Handle regular request
      const validatedData = createRequestSchema.parse(body)

      // Create request
      const newRequest = await RequestService.createRequest({
        userId: user.userId,
        bookId: validatedData.bookId,
        qualityProfileId: validatedData.qualityProfileId,
        notes: validatedData.notes,
      })

      // Update user preferences based on new request (non-blocking)
      RecommendationService.updateUserPreferences(user.userId).catch((error) => {
        // Log but don't fail the request
        logger.error('Failed to update user preferences', { error, userId: user.userId })
      })

      // Process notifications in the background
      const processNotifications = async () => {
        try {
          // Get book details for notification
          const book = await BookService.getBookById(validatedData.bookId)
          if (!book) return

          // Get requesting user's details for notification
          const requestingUser = await db
            .select()
            .from(users)
            .where(eq(users.id, user.userId))
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
              const profile = profiles.find(
                (p) => p.id === validatedData.qualityProfileId
              )
              if (profile) qualityProfileName = profile.name
            }
          } catch (error) {
            logger.error('Failed to fetch quality profile', { error })
          }

          // Send notification to admins
          const adminIds = await NotificationService.getAdminUserIds()

          logger.info('Sending notification to admins', {
            adminIds,
            username,
            bookTitle: book.title,
          })

          await NotificationService.sendNotification(
            adminIds,
            'request_submitted',
            'New Book Request',
            book.title,
            book.author || 'Unknown Author',
            book.description || 'No description available',
            book.coverImage,
            username,
            'Pending',
            qualityProfileName,
            '/requests/all'
          )
        } catch (error) {
          logger.error('Background notification error', { error })
        }
      }

      // Fire and forget
      processNotifications().catch((err) =>
        logger.error('Unhandled notification background error', { err })
      )

      return NextResponse.json({ request: newRequest }, { status: 201 })
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    if (error instanceof Error) {
      logger.error('Create request API error', { error: error.message })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.error('Unexpected create request error', { error })
    return NextResponse.json(
      { error: 'Failed to create request' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler)
export const POST = withLogging(postHandler)

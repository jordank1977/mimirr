import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { RequestService } from '@/lib/services/request.service'
import { BookService } from '@/lib/services/book.service'
import { BookshelfService } from '@/lib/services/bookshelf.service'
import { NotificationService } from '@/lib/services/notification.service'
import * as RecommendationService from '@/lib/services/recommendation.service'
import { createRequestSchema, createOnlyThisBookRequestSchema } from '@/lib/utils/validation'
import { logger } from '@/lib/utils/logger'
import { db, users, settings } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/requests - Get user's requests (all requests for admins)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Admins see all requests, regular users see only their own
    const requests = user.role === 'admin'
      ? await RequestService.getAllRequests()
      : await RequestService.getRequestsByUserId(user.userId)

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
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
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
      try {
        await RecommendationService.updateUserPreferences(user.userId)
      } catch (error) {
        // Log but don't fail the request
        logger.error('Failed to update user preferences', { error, userId: user.userId })
      }

      // Get book details for notification
      const book = await BookService.getBookById(validatedData.bookId)

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
          const profile = profiles.find((p) => p.id === validatedData.qualityProfileId)
          if (profile) qualityProfileName = profile.name
        }
      } catch (error) {
        logger.error('Failed to fetch quality profile', { error })
      }

      // Send notification to admins
      if (book) {
        const adminIds = await NotificationService.getAdminUserIds()

        logger.info('Sending notification to admins', { adminIds, username, bookTitle: book.title })

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
      }

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

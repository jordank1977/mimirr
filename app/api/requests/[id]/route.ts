import { NextRequest, NextResponse } from 'next/server'
import {
  requireAuth,
  requireAdmin,
  handleAuthError,
} from '@/lib/middleware/auth.middleware'
import { RequestService } from '@/lib/services/request.service'
import { BookService } from '@/lib/services/book.service'
import { BookshelfService } from '@/lib/services/bookshelf.service'
import { NotificationService } from '@/lib/services/notification.service'
import { updateRequestSchema } from '@/lib/utils/validation'
import { logger } from '@/lib/utils/logger'
import { db, users, settings } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/requests/[id] - Get a specific request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request)
    const { id } = await params

    const requestData = await RequestService.getRequestById(parseInt(id))

    if (!requestData) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Users can only view their own requests, admins can view all
    if (requestData.userId !== user.userId && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ request: requestData })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Get request API error', { error })
    return NextResponse.json(
      { error: 'Failed to retrieve request' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/requests/[id] - Update a request (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin(request)
    const { id } = await params
    const body = await request.json()

    // Validate input
    const validatedData = updateRequestSchema.parse(body)

    // Update request
    const updatedRequest = await RequestService.updateRequest(parseInt(id), {
      status: validatedData.status,
      notes: validatedData.notes,
      processedBy: user.userId,
    })

    return NextResponse.json({ request: updatedRequest })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    if (error instanceof Error) {
      logger.error('Update request API error', { error: error.message })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.error('Unexpected update request error', { error })
    return NextResponse.json(
      { error: 'Failed to update request' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/requests/[id] - Delete a request
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request)
    const { id } = await params

    const requestData = await RequestService.getRequestById(parseInt(id))

    if (!requestData) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Users can only delete their own pending requests, admins can delete any
    if (user.role !== 'admin') {
      if (requestData.userId !== user.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (requestData.status !== 'pending') {
        return NextResponse.json(
          { error: 'Can only delete pending requests' },
          { status: 400 }
        )
      }
    }

    // Get book details and user details for notification
    const book = await BookService.getBookById(requestData.bookId)
    const requestingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, requestData.userId))
      .limit(1)

    const username = requestingUser[0]?.username || 'A user'

    await RequestService.deleteRequest(parseInt(id))

    // Notify admins that the request was cancelled
    if (book && requestData.status === 'pending') {
      const adminIds = await NotificationService.getAdminUserIds()

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
          const profile = profiles.find((p) => p.id === requestData.qualityProfileId)
          if (profile) qualityProfileName = profile.name
        }
      } catch (error) {
        logger.error('Failed to fetch quality profile', { error })
      }

      await NotificationService.sendNotification(
        adminIds,
        'request_declined',
        'Book Request Cancelled',
        book.title,
        book.author || 'Unknown Author',
        book.description || 'No description available',
        book.coverImage,
        username,
        'Cancelled',
        qualityProfileName,
        '/requests/all'
      )
    }

    return NextResponse.json({ message: 'Request deleted successfully' })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Delete request API error', { error })
    return NextResponse.json(
      { error: 'Failed to delete request' },
      { status: 500 }
    )
  }
}

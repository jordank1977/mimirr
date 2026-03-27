import { NextRequest, NextResponse } from 'next/server'
import { withLogging } from '@/lib/middleware/logging.middleware'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { BookService } from '@/lib/services/book.service'
import { BookshelfService } from '@/lib/services/bookshelf.service'
import { logger } from '@/lib/utils/logger'
import { db, requests, settings } from '@/lib/db'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

async function getHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const payload = await requireAuth(request)

    const { id } = await params

    const book = await BookService.getBookById(id)

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // Check if this book has been requested by the user
    const existingRequest = await db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.userId, payload.userId),
          eq(requests.bookId, id)
        )
      )
      .limit(1)

    let requestStatus = existingRequest[0]?.status
    let requestId = existingRequest[0]?.id
    let availableFormat: string | undefined
    let mimirrState: 'Unowned' | 'Requested' | 'Processing' | 'Available' | 'Unreleased' = 'Unowned'

    // Determine state from existing request
    if (existingRequest[0]) {
      if (requestStatus === 'pending') {
        mimirrState = 'Requested'
      } else if (requestStatus === 'approved' || requestStatus === 'processing' || requestStatus === 'Processing') {
        mimirrState = 'Processing'
      } else if (requestStatus === 'available' || requestStatus === 'Available') {
        mimirrState = 'Available'
      } else if (requestStatus === 'Unreleased') {
        mimirrState = 'Unreleased'
      }
    }

    // If not requested, check Bookshelf library
    if (!existingRequest[0] || mimirrState === 'Unowned') {
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
        try {
          const libraryStatus = await BookshelfService.checkBookInLibrary(
            { url: bookshelfUrl, apiKey: bookshelfApiKey },
            id,
            book.title,
            book.author
          )

          if (libraryStatus.exists) {
            if (libraryStatus.status === 'available' || libraryStatus.status === 'Available') {
              requestStatus = 'Available'
              mimirrState = 'Available'
            } else if (libraryStatus.status === 'unreleased' || libraryStatus.status === 'Unreleased') {
              requestStatus = 'Unreleased'
              mimirrState = 'Unreleased'
            } else if (libraryStatus.status === 'monitored' || libraryStatus.status === 'downloading' || libraryStatus.status === 'Processing' || libraryStatus.status === 'processing') {
              requestStatus = 'Processing'
              mimirrState = 'Processing'
            }
            // We omit `format` from `checkBookInLibrary` so this will be undefined until lazy-loaded
          }
        } catch (error) {
          // Silently fail - don't block book detail if Bookshelf check fails
          logger.error('Failed to check book in Bookshelf', { bookId: book.id, error })
        }
      }
    }

    // Add request status to the book
    const bookWithStatus = {
      ...book,
      requestStatus,
      requestId,
      availableFormat,
      mimirrState,
    }

    return NextResponse.json({ book: bookWithStatus })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Get book API error', { error })
    return NextResponse.json(
      { error: 'Failed to retrieve book' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler)

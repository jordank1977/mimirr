import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { BookService } from '@/lib/services/book.service'
import { BookshelfService } from '@/lib/services/bookshelf.service'
import { logger } from '@/lib/utils/logger'
import { db, requests, settings } from '@/lib/db'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(
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

    // If not requested, check Bookshelf library
    if (!existingRequest[0]) {
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
            book.title,
            book.author
          )

          if (libraryStatus.exists && libraryStatus.status === 'available') {
            requestStatus = 'available'
            availableFormat = libraryStatus.format
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

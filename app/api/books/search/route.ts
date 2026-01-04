import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { BookService } from '@/lib/services/book.service'
import { BookshelfService } from '@/lib/services/bookshelf.service'
import { logger } from '@/lib/utils/logger'
import { db, requests, settings } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const payload = await requireAuth(request)

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    const books = await BookService.searchBooks(query, limit)

    // Check if any of these books have been requested by the user
    const userRequests = await db
      .select()
      .from(requests)
      .where(eq(requests.userId, payload.userId))

    // Create a map of bookId -> request for quick lookup
    const requestMap = new Map(
      userRequests.map(req => [req.bookId, req])
    )

    // Get Bookshelf config to check library
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
    const hasBookshelf = bookshelfUrl && bookshelfApiKey

    // Check each book in Bookshelf library (if configured)
    const booksWithStatus = await Promise.all(
      books.map(async (book) => {
        const existingRequest = requestMap.get(book.id)

        // If already requested, use that status
        if (existingRequest) {
          return {
            ...book,
            requestStatus: existingRequest.status,
            requestId: existingRequest.id,
          }
        }

        // Otherwise, check Bookshelf library
        if (hasBookshelf) {
          try {
            const libraryStatus = await BookshelfService.checkBookInLibrary(
              { url: bookshelfUrl, apiKey: bookshelfApiKey },
              book.title,
              book.author
            )

            if (libraryStatus.exists && libraryStatus.status === 'available') {
              return {
                ...book,
                requestStatus: 'available' as const,
                availableFormat: libraryStatus.format,
              }
            }
          } catch (error) {
            // Silently fail - don't block search if Bookshelf check fails
            logger.error('Failed to check book in Bookshelf', { bookId: book.id, error })
          }
        }

        return book
      })
    )

    return NextResponse.json({ books: booksWithStatus })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Book search API error', { error })
    return NextResponse.json(
      { error: 'Failed to search books' },
      { status: 500 }
    )
  }
}

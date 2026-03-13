import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { BookService } from '@/lib/services/book.service'
import { logger } from '@/lib/utils/logger'
import { db, requests } from '@/lib/db'
import { Book } from '@/types/bookinfo'
import { eq } from 'drizzle-orm'
import { withLogging } from '@/lib/middleware/logging.middleware'

export const dynamic = 'force-dynamic'

async function handler(request: NextRequest) {
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

    // Use the enhanced BookService.searchBooks() which now handles
    // Bookshelf + Hardcover fetching and cover fallback internally
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

    // Add request status to books
    const booksWithStatus = books.map((book) => {
      const existingRequest = requestMap.get(book.id)

      if (existingRequest) {
        return {
          ...book,
          requestStatus: existingRequest.status,
          requestId: existingRequest.id,
        }
      }

      return book
    })

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

export const GET = withLogging(handler)

import { NextRequest, NextResponse } from 'next/server'
import { withLogging } from '@/lib/middleware/logging.middleware'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { BookService } from '@/lib/services/book.service'
import { BookshelfService } from '@/lib/services/bookshelf.service'
import { logger } from '@/lib/utils/logger'
import { db, requests, settings, libraryBooks } from '@/lib/db'
import { and, eq, or, inArray, desc } from 'drizzle-orm'

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

    // 1. Identify all possible ID aliases for this book
    const idCandidates = Array.from(new Set([id, book.foreignBookId, (book as any).foreignId].filter(Boolean))) as string[]
    const idCondition = or(
      inArray(requests.bookId, idCandidates),
      inArray(requests.foreignBookId, idCandidates)
    )

    // Check if this book has been requested by the current user first
    const userRequest = await db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.userId, payload.userId),
          idCondition
        )
      )
      .orderBy(desc(requests.requestedAt))
      .limit(1)

    // If current user has no request, check for any active system request (e.g. for admin viewing all requests)
    let matchedRequest = userRequest[0]
    if (!matchedRequest) {
      const anyRequest = await db
        .select()
        .from(requests)
        .where(idCondition)
        .orderBy(desc(requests.requestedAt))
        .limit(1)

      if (anyRequest.length > 0) {
        matchedRequest = anyRequest[0]
      }
    }

    let requestStatus = matchedRequest?.status
    let requestId = matchedRequest?.id
    let qualityProfileId = matchedRequest?.qualityProfileId
    let availableFormat: string | undefined
    let mimirrState: 'Unowned' | 'Requested' | 'Processing' | 'Available' | 'Unreleased' = 'Unowned'

    // Determine state from existing request
    if (matchedRequest) {
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

    // If not requested or still unowned, check Bookshelf library
    if (!matchedRequest || mimirrState === 'Unowned') {
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
          const targetLookupId = book.foreignBookId || id
          const libraryStatus = await BookshelfService.checkBookInLibrary(
            { url: bookshelfUrl, apiKey: bookshelfApiKey },
            targetLookupId,
            book.title,
            book.author
          )

          if (libraryStatus.exists) {
            if (libraryStatus.status === 'available' || libraryStatus.status === 'Available') {
              requestStatus = 'available'
              mimirrState = 'Available'
            } else if (libraryStatus.status === 'unreleased' || libraryStatus.status === 'Unreleased') {
              requestStatus = 'Unreleased'
              mimirrState = 'Unreleased'
            } else if (libraryStatus.status === 'monitored' || libraryStatus.status === 'downloading' || libraryStatus.status === 'Processing' || libraryStatus.status === 'processing') {
              requestStatus = 'processing'
              mimirrState = 'Processing'
            }
            if (libraryStatus.bookshelfId && (!book.coverImage || book.coverImage.includes('MediaCoverProxy'))) {
              book.coverImage = `/MediaCover/Books/${libraryStatus.bookshelfId}/cover.jpeg`
            }
          }
        } catch (error) {
          // Silently fail - don't block book detail if Bookshelf check fails
          logger.error('Failed to check book in Bookshelf', { bookId: book.id, error: error instanceof Error ? error.message : error })
        }
      }

      // Local libraryBooks fallback if still Unowned
      if (mimirrState === 'Unowned' && idCandidates.length > 0) {
        try {
          const localLibraryMatch = await db
            .select()
            .from(libraryBooks)
            .where(inArray(libraryBooks.foreignBookId, idCandidates))
            .limit(1)

          if (localLibraryMatch.length > 0) {
            const item = localLibraryMatch[0]
            if (item.status === 'available' || item.status === 'Available') {
              requestStatus = 'available'
              mimirrState = 'Available'
            } else if (item.status === 'unreleased' || item.status === 'Unreleased') {
              requestStatus = 'Unreleased'
              mimirrState = 'Unreleased'
            } else {
              requestStatus = 'processing'
              mimirrState = 'Processing'
            }
          }
        } catch (localErr) {
          logger.error('Failed to check local libraryBooks', { error: localErr instanceof Error ? localErr.message : localErr })
        }
      }
    }

    const isbn = book.isbn13 || book.isbn
    if (isbn) {
      if (book.coverImage && book.coverImage.includes('/api/mediacover/') && !book.coverImage.includes('isbn=')) {
        const sep = book.coverImage.includes('?') ? '&' : '?'
        book.coverImage = `${book.coverImage}${sep}isbn=${encodeURIComponent(isbn)}`
      } else if (!book.coverImage) {
        book.coverImage = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`
      }
    }

    // Add request status to the book
    const bookWithStatus = {
      ...book,
      requestStatus,
      requestId,
      qualityProfileId,
      availableFormat,
      mimirrState,
    }

    return NextResponse.json({ book: bookWithStatus })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Get book API error', { error: error instanceof Error ? error.message : error })
    return NextResponse.json(
      { error: 'Failed to retrieve book' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler)

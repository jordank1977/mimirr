import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { BookService } from '@/lib/services/book.service'
import { BookshelfService, BookshelfConfig } from '@/lib/services/bookshelf.service'
import { logger } from '@/lib/utils/logger'
import { db, requests, settings } from '@/lib/db'
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

    // Get Bookshelf config
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
    const bookshelfConfig: BookshelfConfig | null = hasBookshelf
      ? { url: bookshelfUrl, apiKey: bookshelfApiKey }
      : null

    let books: Book[] = []

    if (bookshelfConfig) {
      // Hijack: Search via Bookshelf directly
      const bookshelfResults = await BookshelfService.searchBooks(bookshelfConfig, query)
      
      // Map Bookshelf results to Mimirr Book format
      books = bookshelfResults.map((b: any) => {
        // Bookshelf's lookup returns author info differently than the library.
        // We prioritize explicit authorName, then fallback to parsing authorTitle if necessary.
        let authorName = b.author?.authorName || b.authorName;
        
        if (!authorName && b.authorTitle) {
          // authorTitle is often "Last, First Title" or "First Last Title"
          // We try to extract the author part by removing the book title from the end
          authorName = b.authorTitle.replace(b.title, '').trim();
        }
        
        if (!authorName) authorName = 'Unknown Author';

        // Images: prioritize remoteCover (absolute URL) over local proxy paths
        const coverImage = b.remoteCover || 
                           b.images?.find((img: any) => img.coverType === 'cover')?.url || 
                           b.images?.[0]?.url;
        
        // Ratings: Bookshelf lookup might have ratings in b.ratings or hidden in editions
        let rating = b.ratings?.value || b.ratings?.averageRating || 0;
        if (rating === 0 && b.editions?.length > 0) {
          // Scan editions for the best rating
          rating = Math.max(...b.editions.map((e: any) => e.ratings?.value || e.ratings?.averageRating || 0));
        }

        return {
          id: b.foreignBookId,
          title: b.title,
          author: authorName,
          authors: [authorName],
          description: b.overview || b.description,
          coverImage: coverImage,
          isbn: b.isbn,
          publishedDate: b.releaseDate,
          publisher: b.publisher,
          rating: rating,
          genres: b.genres || [],
          // Keep the raw bookshelf data for later if needed, though we store by foreignBookId
          metadata: b 
        } as Book
      })

      // Also cache these results so they're available for detail pages
      for (const book of books) {
        await BookService.cacheBook(book)
      }
    } else {
      // Fallback to Mimirr's own search if Bookshelf isn't configured
      books = await BookService.searchBooks(query, limit)
    }

    // Check if any of these books have been requested by the user
    const userRequests = await db
      .select()
      .from(requests)
      .where(eq(requests.userId, payload.userId))

    // Create a map of bookId -> request for quick lookup
    const requestMap = new Map(
      userRequests.map(req => [req.bookId, req])
    )

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
        if (bookshelfConfig) {
          try {
            // Bookshelf search results already contain library status!
            // We can optimize this by checking the raw metadata if available
            if (book.metadata && book.metadata.statistics) {
              const fileCount = book.metadata.statistics.bookFileCount || 0
              const isGrabbed = book.metadata.grabbed === true

              if (fileCount > 0) {
                return {
                  ...book,
                  requestStatus: 'available' as const,
                  // Format might be in the metadata if lookup provides it
                  availableFormat: book.metadata.quality?.quality?.name
                }
              } else if (isGrabbed) {
                return {
                  ...book,
                  requestStatus: 'processing' as const
                }
              }
            }

            // Fallback to library check if metadata doesn't have status
            const libraryStatus = await BookshelfService.checkBookInLibrary(
              bookshelfConfig,
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

export const GET = withLogging(handler)

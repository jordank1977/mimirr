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
      // Step 1: Run Bookshelf lookup
      const bookshelfResults = await BookshelfService.searchBooks(bookshelfConfig, query);

      // DEBUG: Log raw bookshelf results to help diagnose missing description
      if (bookshelfResults.length > 0) {
        const debugSample = bookshelfResults.slice(0, 2).map((b: any) => ({
          title: b.title,
          overview: b.overview,
          description: b.description,
          hasEditions: b.editions?.length > 0,
          editionSample: b.editions?.[0] ? {
            title: b.editions[0].title,
            overview: b.editions[0].overview,
            description: b.editions[0].description
          } : 'none'
        }));
        logger.info('DEBUG: Raw Bookshelf Results Sample', { sample: debugSample });
      }

      // Step 2: Fetch Mimirr's own search results to find the correct Book IDs for metadata enrichment.
      // Bookshelf provides Work IDs (e.g., 2014321), but we need Book IDs (e.g., 32186357) for detailed metadata.
      const hardcoverSearchResults = await BookService.searchBooks(query, limit).catch(() => []);
      const hardcoverSearchMap = new Map(hardcoverSearchResults.map(h => [h.title.toLowerCase(), h]));
      
      // Extract the correct IDs for the books found by Bookshelf
      const bookIdsToFetch = bookshelfResults.map((b: any) => {
        const match = hardcoverSearchMap.get(b.title.toLowerCase());
        return match?.id;
      }).filter(Boolean) as string[];

      const hardcoverMap = await BookService.getBooksByIds(bookIdsToFetch);
      
      // Step 3: Map Bookshelf results to Mimirr Book format, merging in Hardcover metadata
      books = bookshelfResults.map((b: any) => {
        const hardcoverSearchMatch = hardcoverSearchMap.get(b.title.toLowerCase());
        const hardcoverBook = hardcoverSearchMatch ? (hardcoverMap.get(hardcoverSearchMatch.id) || null) : null;
        
        // Author Mapping: Prioritize explicit authorName, fallback to authorTitle, then Hardcover
        let authorName = b.author?.authorName || b.authorName;

        if (!authorName && b.authorTitle) {
          authorName = b.authorTitle.replace(b.title, '').trim();
        }

        if (authorName) {
          // Fix "last, first" formatting
          if (authorName.includes(',')) {
            const parts = authorName.split(',');
            if (parts.length === 2) {
              authorName = `${parts[1].trim()} ${parts[0].trim()}`;
            }
          }

          // Capitalize each word properly
          authorName = authorName
            .toLowerCase()
            .split(' ')
            .filter((word: string) => word.length > 0)
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
        
        // Use Hardcover author if it's more complete or as fallback
        if (!authorName || authorName === 'Unknown Author' || authorName.length < 3) {
          authorName = hardcoverBook?.author || authorName || 'Unknown Author';
        }

        // Images: PRIORITIZE Hardcover image (most reliable for frontend).
        // Fallback to remoteCover (Bookshelf absolute URL), then proxy.
        let coverImage = hardcoverBook?.coverImage || b.remoteCover;
        
        if (!coverImage && b.images && b.images.length > 0) {
          // Bookshelf sometimes returns the full URL in the 'url' field of an image object
          const coverImg = b.images.find((img: any) => img.coverType === 'cover') || b.images[0];
          const path = coverImg.url;

          if (path) {
            if (path.startsWith('http')) {
              coverImage = path;
            } else if (path.startsWith('/')) {
              const joinChar = path.includes('?') ? '&' : '?';
              coverImage = `${bookshelfUrl.replace(/\/$/, '')}${path}${joinChar}apikey=${bookshelfApiKey}`;
            }
          }
        }

        // Ratings: Merge Bookshelf and Hardcover ratings
        let rating = b.ratings?.value || b.ratings?.averageRating || 0;
        if (rating === 0 && b.editions?.length > 0) {
          rating = Math.max(...b.editions.map((e: any) => e.ratings?.value || e.ratings?.averageRating || 0));
        }
        if (rating === 0 && hardcoverBook?.rating) {
          rating = hardcoverBook.rating;
        }

        // Genres & Description fallbacks
        const genres = b.genres?.length > 0 ? b.genres : (hardcoverBook?.genres || []);
        const description = b.overview || b.description || hardcoverBook?.description;

        return {
          id: b.foreignBookId,
          title: b.title,
          author: authorName,
          authors: hardcoverBook?.authors || [authorName],
          description: description,
          coverImage: coverImage,
          isbn: b.isbn || hardcoverBook?.isbn,
          publishedDate: b.releaseDate || hardcoverBook?.publishedDate,
          publisher: b.publisher || hardcoverBook?.publisher,
          rating: rating,
          genres: genres,
          // Keep the raw bookshelf data for later if needed, though we store by foreignBookId
          metadata: b 
        } as Book
      })

      // Also cache these merged results
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
    const booksWithStatus = books.map((book) => {
      const existingRequest = requestMap.get(book.id)

      // If already requested, use that status
      if (existingRequest) {
        return {
          ...book,
          requestStatus: existingRequest.status,
          requestId: existingRequest.id,
        }
      }

      // Otherwise, check Bookshelf metadata for library status
      if (bookshelfConfig && book.metadata) {
        const isGrabbed = book.metadata.grabbed === true
        const isAdded = book.metadata.authorId > 0 // If authorId > 0, it means it's already in the library

        if (isAdded) {
          // If it's added but we don't have statistics (common in lookup results), 
          // we can at least mark it as 'available' or 'processing' if grabbed.
          if (isGrabbed) {
            return {
              ...book,
              requestStatus: 'processing' as const
            }
          } else {
            return {
              ...book,
              requestStatus: 'available' as const
            }
          }
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

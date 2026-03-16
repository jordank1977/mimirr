import { db, bookCache, settings, libraryBooks, type BookCache, type NewBookCache } from '@/lib/db'
import { eq, inArray } from 'drizzle-orm'
import { BookinfoService } from './bookinfo.service'
import { logger } from '@/lib/utils/logger'
import type { Book } from '@/types/bookinfo'
import { MOOD_KEYWORDS, PACE_KEYWORDS } from './recommendation.service'

export class BookService {
  private static CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

  /**
   * Check if cached book is still valid
   */
  private static isCacheValid(cachedBook: BookCache): boolean {
    const now = new Date()
    const cacheAge = now.getTime() - cachedBook.cachedAt.getTime()
    return cacheAge < this.CACHE_TTL
  }

  /**
   * Save book to cache
   */
  static async cacheBook(book: Book): Promise<void> {
    try {
      const now = new Date()

      const cacheData: NewBookCache = {
        id: book.id,
        title: book.title,
        author: book.author,
        coverImage: book.coverImage,
        description: book.description,
        isbn: book.isbn,
        isbn13: book.isbn13,
        publishedDate: book.publishedDate,
        publisher: book.publisher,
        pageCount: book.pageCount,
        genres: JSON.stringify(book.genres),
        rating: book.rating?.toString() || null,
        metadata: JSON.stringify(book),
        cachedAt: now,
        lastAccessedAt: now,
      }

      // Upsert (insert or update)
      await db
        .insert(bookCache)
        .values(cacheData)
        .onConflictDoUpdate({
          target: bookCache.id,
          set: {
            ...cacheData,
            lastAccessedAt: now,
          },
        })

      logger.debug('Book cached', { bookId: book.id, title: book.title })
    } catch (error) {
      logger.error('Failed to cache book', { error, bookId: book.id })
      // Don't throw - caching is not critical
    }
  }

  /**
   * Update last accessed time
   */
  private static async updateLastAccessed(bookId: string): Promise<void> {
    try {
      await db
        .update(bookCache)
        .set({ lastAccessedAt: new Date() })
        .where(eq(bookCache.id, bookId))
    } catch (error) {
      logger.error('Failed to update last accessed', { error, bookId })
    }
  }

  /**
   * Search for books using Bookinfo/Hardcover for metadata and local library for availability
   */
  static async searchBooks(query: string, limit = 20): Promise<Book[]> {
    try {
      // Fetch books from Bookinfo/Hardcover (now the sole source of metadata)
      const hardcoverBooks = await BookinfoService.searchBooks(query, limit).catch((error) => {
        logger.warn('Hardcover search failed', { error, query })
        return [] // Graceful degradation
      })

      if (hardcoverBooks.length === 0) {
        logger.debug('No books found from Hardcover', { query })
        return []
      }

      // Extract book IDs for local library lookup
      const bookIds = hardcoverBooks.map(book => book.id).filter(Boolean)
      
      // Query local library_books table for availability status
      let libraryStatusMap = new Map<string, string>()
      if (bookIds.length > 0) {
        const libraryBooksResult = await db
          .select()
          .from(libraryBooks)
          .where(inArray(libraryBooks.foreignBookId, bookIds))

        // Create a map for quick lookup: foreignBookId -> status
        libraryStatusMap = new Map(
          libraryBooksResult.map((libBook: any) => [libBook.foreignBookId, libBook.status])
        )
      }

      // Transform Hardcover results with local library status
      const books: Book[] = hardcoverBooks.map((hardcoverBook: Book) => {
        const libraryStatus = libraryStatusMap.get(hardcoverBook.id)
        
        // Determine availability status based on local library
        let status = 'unrequested' // Default status
        if (libraryStatus === 'available') {
          status = 'Available'
        } else if (libraryStatus === 'monitored' || libraryStatus === 'processing') {
          status = 'Processing'
        }

        // Extract tags/subjects from metadata for mood and pace harvesting
        const hardcoverTags = hardcoverBook.metadata?.tags || hardcoverBook.metadata?.subjects || []
        
        // Filter tags against mood and pace keywords
        const moodTags = hardcoverTags.filter((tag: string) => 
          MOOD_KEYWORDS.some(keyword => 
            tag.toLowerCase().includes(keyword.toLowerCase()) || 
            keyword.toLowerCase().includes(tag.toLowerCase())
          )
        )
        const paceTags = hardcoverTags.filter((tag: string) => 
          PACE_KEYWORDS.some(keyword => 
            tag.toLowerCase().includes(keyword.toLowerCase()) || 
            keyword.toLowerCase().includes(tag.toLowerCase())
          )
        )
        
        // Combine base genres with mood and pace tags
        const allGenres = [...new Set([...(hardcoverBook.genres || []), ...moodTags, ...paceTags])]
        
        return {
          id: hardcoverBook.id,
          title: hardcoverBook.title,
          description: hardcoverBook.description,
          coverImage: hardcoverBook.coverImage,
          author: hardcoverBook.author,
          authors: hardcoverBook.authors || [hardcoverBook.author],
          isbn: hardcoverBook.isbn || '',
          isbn13: hardcoverBook.isbn13 || '',
          pageCount: hardcoverBook.pageCount || 0,
          publishedDate: hardcoverBook.publishedDate,
          publisher: hardcoverBook.publisher || '',
          rating: hardcoverBook.rating || 0,
          genres: allGenres,
          metadata: {
            ...hardcoverBook.metadata,
            status: status // Add status to metadata for frontend
          }
        }
      })

      // Cache all books
      for (const book of books) {
        await this.cacheBook(book)
      }

      logger.debug('Local search completed with library mirror', { 
        query, 
        results: books.length,
        booksWithLibraryStatus: books.filter(b => b.metadata?.status !== 'unrequested').length
      })

      return books
    } catch (error) {
      logger.error('Local book search failed', { error, query })
      throw new Error('Failed to search books')
    }
  }

  /**
   * Get multiple books by IDs (with caching) - Optimized for batch fetching
   */
  static async getBooksByIds(ids: string[]): Promise<Map<string, Book | null>> {
    const results = new Map<string, Book | null>()

    if (ids.length === 0) {
      return results
    }

    try {
      // Fetch all from cache in one query
      const cached = await db
        .select()
        .from(bookCache)
        .where(inArray(bookCache.id, ids))

      // Process cached results
      const cacheHits = new Set<string>()
      const now = new Date()

      for (const cachedBook of cached) {
        // Use the cache regardless of TTL for bulk UI requests to prevent
        // unnecessary external API fetches that can result in 'Unknown Book' fallbacks.
        // We only care if the metadata exists in the database.
        if (cachedBook.metadata) {
          const book = JSON.parse(cachedBook.metadata) as Book
          results.set(String(cachedBook.id), book)
          cacheHits.add(String(cachedBook.id))
        }
      }

      // Find cache misses
      const cacheMisses = ids.filter(id => !cacheHits.has(id))

      if (cacheMisses.length > 0) {
        logger.debug(`Cache miss for ${cacheMisses.length} books`, { cacheMisses })

        // Try to fetch missing books from BookinfoService
        try {
          // Convert string IDs to numbers for BookinfoService
          const numericIds = cacheMisses
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id))

          if (numericIds.length > 0) {
            // Use AbortController for timeout
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 8000)

            try {
              // Fetch books in bulk
              const fetchedBooks = await BookinfoService.getBulkBooks(numericIds, controller.signal)
              
              // Cache and add to results
              for (const book of fetchedBooks) {
                await this.cacheBook(book)
                results.set(book.id, book)
                cacheHits.add(book.id)
              }

              // Update which IDs are still missing after fetch
              const fetchedIds = new Set(fetchedBooks.map(b => b.id))
              const stillMissing = cacheMisses.filter(id => !fetchedIds.has(id))

              // Create fallback for any remaining missing books
              for (const id of stillMissing) {
                const fallbackBook: Book = {
                  id,
                  title: 'Unknown Book',
                  author: 'Unknown Author',
                  authors: ['Unknown Author'],
                  description: '',
                  coverImage: undefined,
                  isbn: '',
                  isbn13: '',
                  pageCount: 0,
                  publishedDate: undefined,
                  publisher: '',
                  rating: 0,
                  genres: [],
                  metadata: { id, title: 'Unknown Book', author: 'Unknown Author' }
                }
                results.set(id, fallbackBook)
                logger.debug('Created fallback book after failed fetch', { bookId: id })
              }
            } finally {
              clearTimeout(timeoutId)
            }
          } else {
            // All IDs were invalid numbers, create fallbacks
            for (const id of cacheMisses) {
              const fallbackBook: Book = {
                id,
                title: 'Unknown Book',
                author: 'Unknown Author',
                authors: ['Unknown Author'],
                description: '',
                coverImage: undefined,
                isbn: '',
                isbn13: '',
                pageCount: 0,
                publishedDate: undefined,
                publisher: '',
                rating: 0,
                genres: [],
                metadata: { id, title: 'Unknown Book', author: 'Unknown Author' }
              }
              results.set(id, fallbackBook)
              logger.debug('Created fallback for invalid numeric ID', { bookId: id })
            }
          }
        } catch (fetchError) {
          logger.error('Failed to fetch missing books from BookinfoService', { 
            error: fetchError, 
            cacheMisses 
          })
          
          // Create fallback objects for all cache misses
          for (const id of cacheMisses) {
            const fallbackBook: Book = {
              id,
              title: 'Unknown Book',
              author: 'Unknown Author',
              authors: ['Unknown Author'],
              description: '',
              coverImage: undefined,
              isbn: '',
              isbn13: '',
              pageCount: 0,
              publishedDate: undefined,
              publisher: '',
              rating: 0,
              genres: [],
              metadata: { id, title: 'Unknown Book', author: 'Unknown Author' }
            }
            results.set(id, fallbackBook)
            logger.debug('Created fallback book after fetch failure', { bookId: id })
          }
        }
      }

      // Update last accessed for cache hits
      if (cacheHits.size > 0) {
        await db
          .update(bookCache)
          .set({ lastAccessedAt: now })
          .where(inArray(bookCache.id, Array.from(cacheHits)))
      }

      return results
    } catch (error) {
      logger.error('Failed to get books by IDs', { error, count: ids.length })
      // Return empty results for failed fetches
      for (const id of ids) {
        if (!results.has(id)) {
          results.set(id, null)
        }
      }
      return results
    }
  }

  /**
   * Get book by ID (with caching)
   */
  static async getBookById(id: string): Promise<Book | null> {
    try {
      // First check cache for valid entry
      const cached = await db
        .select()
        .from(bookCache)
        .where(eq(bookCache.id, id))
        .limit(1)

      if (cached.length > 0 && cached[0].metadata) {
        const cachedBook = cached[0]
        const metadata = cachedBook.metadata // Extract to help TypeScript
        
        // Check if cache is still valid
        if (this.isCacheValid(cachedBook) && metadata) {
          logger.debug('Using valid cached book', { bookId: id })
          await this.updateLastAccessed(id)
          return JSON.parse(metadata) as Book
        } else {
          logger.debug('Cache expired, attempting to refresh', { bookId: id })
        }
      }

      // Cache miss or expired, try to fetch from BookinfoService
      try {
        // Use AbortController for timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)

        try {
          const book = await BookinfoService.getBookById(id, controller.signal)
          
          if (book) {
            // Cache the fetched book
            await this.cacheBook(book)
            logger.debug('Fetched and cached book from BookinfoService', { bookId: id })
            return book
          } else {
            logger.debug('Book not found in BookinfoService', { bookId: id })
            
            // Check if we have stale cache as fallback
            if (cached.length > 0 && cached[0].metadata) {
              logger.debug('Using stale cache as fallback', { bookId: id })
              const fallbackMetadata = cached[0].metadata
              if (fallbackMetadata) {
                return JSON.parse(fallbackMetadata) as Book
              }
            }
            
            return null
          }
        } finally {
          clearTimeout(timeoutId)
        }
      } catch (fetchError) {
        logger.error('Failed to fetch book from BookinfoService', { 
          error: fetchError, 
          bookId: id 
        })
        
        // Check if we have any cache as fallback
        if (cached.length > 0 && cached[0].metadata) {
          logger.debug('Using cache as fallback after fetch failure', { bookId: id })
          const fallbackMetadata = cached[0].metadata
          if (fallbackMetadata) {
            return JSON.parse(fallbackMetadata) as Book
          }
        }
        
        return null
      }
    } catch (error) {
      logger.error('Failed to get book by ID', { error, bookId: id })
      throw new Error('Failed to retrieve book')
    }
  }

  /**
   * Get popular books
   */
  static async getPopularBooks(limit = 20): Promise<Book[]> {
    try {
      const books = await BookinfoService.getRecommendedBooks(limit)

      // Cache all books
      for (const book of books) {
        await this.cacheBook(book)
      }

      return books
    } catch (error) {
      logger.error('Failed to get popular books', { error })
      throw new Error('Failed to retrieve popular books')
    }
  }

  /**
   * Get new releases
   */
  static async getNewReleases(limit = 20): Promise<Book[]> {
    try {
      const books = await BookinfoService.getNewReleases(limit)

      // Cache all books
      for (const book of books) {
        await this.cacheBook(book)
      }

      return books
    } catch (error) {
      logger.error('Failed to get new releases', { error })
      throw new Error('Failed to retrieve new releases')
    }
  }
}

import { db, bookCache, type BookCache, type NewBookCache } from '@/lib/db'
import { eq, inArray } from 'drizzle-orm'
import { BookinfoService } from './bookinfo.service'
import { logger } from '@/lib/utils/logger'
import type { Book } from '@/types/bookinfo'

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
        rating: book.rating?.toString(),
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
   * Get book from cache
   */
  private static async getFromCache(bookId: string): Promise<Book | null> {
    try {
      const result = await db
        .select()
        .from(bookCache)
        .where(eq(bookCache.id, bookId))
        .limit(1)

      if (result.length === 0) {
        return null
      }

      const cached = result[0]

      if (!this.isCacheValid(cached)) {
        logger.debug('Cache expired', { bookId })
        return null
      }

      // Update last accessed time
      await this.updateLastAccessed(bookId)

      // Parse metadata
      if (!cached.metadata) {
        logger.error('Cached book has no metadata', { bookId })
        return null
      }
      const book = JSON.parse(cached.metadata) as Book

      logger.debug('Book retrieved from cache', { bookId })
      return book
    } catch (error) {
      logger.error('Failed to retrieve from cache', { error, bookId })
      return null
    }
  }

  /**
   * Search for books
   */
  static async searchBooks(query: string, limit = 20): Promise<Book[]> {
    try {
      const books = await BookinfoService.searchBooks(query, limit)

      // Cache all books
      for (const book of books) {
        await this.cacheBook(book)
      }

      return books
    } catch (error) {
      logger.error('Book search failed', { error, query })
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
      // TEMP: Treat everything as a cache miss to verify fresh metadata fetch
      const cached: any[] = []
      /*
      // Fetch all from cache in one query
      const cached = await db
        .select()
        .from(bookCache)
        .where(inArray(bookCache.id, ids))
      */

      // Process cached results
      const cacheHits = new Set<string>()
      const now = new Date()

      for (const cachedBook of cached) {
        if (this.isCacheValid(cachedBook) && cachedBook.metadata) {
          const book = JSON.parse(cachedBook.metadata) as Book
          results.set(cachedBook.id, book)
          cacheHits.add(cachedBook.id)
        }
      }

      // Find cache misses
      const cacheMisses = ids.filter(id => !cacheHits.has(id))

      if (cacheMisses.length > 0) {
        logger.debug(`Cache miss for ${cacheMisses.length} books, fetching from API`)

        // Optimized: Use bulk fetching for all cache misses in one single call
        try {
          // Note: BookinfoService.getBulkBooks expects number IDs
          const numericIds = cacheMisses.map(id => parseInt(id)).filter(id => !isNaN(id))
          const fetchedBooks = await BookinfoService.getBulkBooks(numericIds)

          // Map of id -> book for easy lookup
          const fetchedMap = new Map(fetchedBooks.map(b => [b.id, b]))

          // Cache and add to results
          for (const id of cacheMisses) {
            const book = fetchedMap.get(id)

            if (book) {
              await this.cacheBook(book)
              results.set(id, book)
            } else {
              // Fallback: If API fails or returns null, use the stale/0-rating cached version if available
              const cachedBook = cached.find(c => c.id === id)
              if (cachedBook && cachedBook.metadata) {
                logger.debug('Using stale/0-rating cache as fallback', { bookId: id })
                results.set(id, JSON.parse(cachedBook.metadata) as Book)
              } else {
                results.set(id, null)
              }
            }
          }
        } catch (error) {
          logger.error('Failed to fetch bulk books during metadata enrichment', { error, cacheMisses })
          // Fallback for all misses
          for (const id of cacheMisses) {
            const cachedBook = cached.find(c => c.id === id)
            if (cachedBook && cachedBook.metadata) {
              results.set(id, JSON.parse(cachedBook.metadata) as Book)
            } else {
              results.set(id, null)
            }
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
      // TEMP: Skip cache to verify fresh metadata fetch
      /*
      const cached = await this.getFromCache(id)
      if (cached) {
        return cached
      }
      */

      // Fetch from Bookinfo API
      logger.debug('Cache miss, fetching from API', { bookId: id })
      let book: Book | null = null
      
      try {
        book = await BookinfoService.getBookById(id)
      } catch (error) {
        logger.error('Failed to fetch book from API, attempting fallback', { error, bookId: id })
      }

      if (!book) {
        // Fallback: Check if we have an expired/0-rating cached version
        const fallbackCache = await db
          .select()
          .from(bookCache)
          .where(eq(bookCache.id, id))
          .limit(1)

        if (fallbackCache.length > 0 && fallbackCache[0].metadata) {
          logger.debug('Using stale/0-rating cache as fallback', { bookId: id })
          return JSON.parse(fallbackCache[0].metadata) as Book
        }
        
        return null
      }

      // Cache the book
      await this.cacheBook(book)

      return book
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

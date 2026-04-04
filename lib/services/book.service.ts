import { db, bookCache, settings, libraryBooks, type BookCache, type NewBookCache } from '@/lib/db'
import { eq, inArray } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'
import type { Book } from '@/types/bookinfo'
import { MOOD_KEYWORDS, PACE_KEYWORDS } from './recommendation.service'

export class BookService {
  private static CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

  /**
   * Check if cached book is still valid
   * High-Fidelity Check: If missing critical Golden fields, treat as expired regardless of age.
   */
  private static isCacheValid(cachedBook: BookCache): boolean {
    const now = new Date()
    const cacheAge = now.getTime() - cachedBook.cachedAt.getTime()

    // Check for Golden fields
    const hasGoldenFields =
      cachedBook.description &&
      cachedBook.isbn13 &&
      cachedBook.publisher &&
      cachedBook.description !== "No description available" &&
      cachedBook.description !== "Description available after requesting" &&
      cachedBook.isbn13 !== "Unknown ISBN" &&
      cachedBook.publisher !== "Unknown Publisher";

    if (!hasGoldenFields) {
      return false; // Force re-hydration
    }

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
      logger.error('Failed to cache book', { error: error instanceof Error ? error.message : error, bookId: book.id })
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
      logger.error('Failed to update last accessed', { error: error instanceof Error ? error.message : error, bookId })
    }
  }

  /**
   * Helper to safely parse genres from cache to handle bad data from previous sync errors
   */
  private static parseGenres(genresStr: string | null | undefined): string[] {
    if (!genresStr) return []
    try {
      const parsed = JSON.parse(genresStr)
      if (Array.isArray(parsed)) {
        return parsed
      }
      return []
    } catch (e) {
      // Handle legacy/corrupt comma-separated string format
      if (typeof genresStr === 'string') {
        return genresStr.split(',').map(s => s.trim()).filter(Boolean)
      }
      return []
    }
  }

  /**
   * Helper to format a cache object or generic Book into the TargetBookShape required by the frontend
   */
  private static formatToTargetShape(id: string, cachedBook: any): any {
    const genres = this.parseGenres(cachedBook.genres)
    const rating = cachedBook.rating ? parseFloat(cachedBook.rating) : 0
    const pageCount = cachedBook.pageCount || 0
    const mapped = {
      "Book Title": cachedBook.title,
      "Book Author": cachedBook.author || 'Unknown Author',
      "Rating": rating,
      "Pages": pageCount,
      "Published Date": cachedBook.publishedDate || 'Unknown Date',
      "Publisher": cachedBook.publisher || "Unknown Publisher",
      "ISBN": cachedBook.isbn13 || cachedBook.isbn || "Unknown ISBN",
      "Description": cachedBook.description || "No description available",
      "Genres": Array.isArray(genres) ? genres.join(", ") : "",
      "Cover Art": cachedBook.coverImage === 'null' ? undefined : (cachedBook.coverImage || undefined),
    }

    return {
      id: id,
      title: mapped["Book Title"],
      author: mapped["Book Author"],
      authors: [mapped["Book Author"]],
      rating: mapped["Rating"],
      pageCount: mapped["Pages"],
      publishedDate: mapped["Published Date"],
      publisher: mapped["Publisher"],
      isbn13: mapped["ISBN"],
      description: mapped["Description"],
      genres: Array.isArray(genres) ? genres : [],
      coverImage: mapped["Cover Art"],
      _rawMapping: mapped,
      foreignBookId: id,
      readarrBookId: undefined
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

      const cacheHits = new Set<string>()
      const now = new Date()

      for (const cachedBook of cached) {
        const bookShape = this.formatToTargetShape(String(cachedBook.id), cachedBook)
        results.set(String(cachedBook.id), bookShape)
        cacheHits.add(String(cachedBook.id))
      }

      // Find cache misses
      const cacheMisses = ids.filter(id => !cacheHits.has(id))

      if (cacheMisses.length > 0) {
        logger.debug(`Cache miss for ${cacheMisses.length} books`, { cacheMisses })

        // Use Promise.all to fetch misses
        const fetchedBooks = await Promise.all(cacheMisses.map(id => this.getBookById(id)))

        for (let i = 0; i < cacheMisses.length; i++) {
          const id = cacheMisses[i]
          const book = fetchedBooks[i]
          
          if (book) {
            results.set(id, book)
            cacheHits.add(id)
          } else {
            // Create fallback for failed fetch
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
      logger.error('Failed to get books by IDs', { error: error instanceof Error ? error.message : error, count: ids.length })
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

      if (cached.length > 0) {
        const cachedBook = cached[0]
        const cachedParsedBook = this.formatToTargetShape(id, cachedBook)
        
        // Check if cache is still valid
        if (this.isCacheValid(cachedBook)) {
          logger.debug('Using valid cached book', { bookId: id })
          await this.updateLastAccessed(id)
          return cachedParsedBook
        } else {
          logger.debug('Cache expired, attempting to refresh', { bookId: id })
        }
      }

      // Cache miss or expired, try to fetch from Readarr
      try {
        const { ReadarrService } = await import('@/lib/services/readarr.service');

        // Step 1: Look up the book in Readarr.
        // `searchBooks` now returns TargetBookShape[] mapped with Golden Payload.
        let targetBookShape: any = null;
        try {
          const books = await ReadarrService.searchBooks(`goodreads:${id}`);
          if (Array.isArray(books) && books.length > 0) {
            // Pick the first result from the array which contains the 10-field payload
            targetBookShape = books[0];
          }
        } catch (innerError) {
          logger.error('Failed to look up book in Readarr via ReadarrService', { error: innerError instanceof Error ? innerError.message : innerError, bookId: id })
          throw innerError
        }

        if (targetBookShape) {
          // Map TargetBookShape to Book type (they are mostly compatible, we just cast it safely)
          const book: any = {
            id: id, // Ensure ID stays exactly what was asked for
            title: targetBookShape.title,
            author: targetBookShape.author,
            authors: targetBookShape.authors,
            rating: targetBookShape.rating,
            pageCount: targetBookShape.pageCount,
            publishedDate: targetBookShape.publishedDate,
            publisher: targetBookShape.publisher,
            isbn13: targetBookShape.isbn13,
            description: targetBookShape.description,
            genres: targetBookShape.genres,
            coverImage: targetBookShape.coverImage,
            _rawMapping: targetBookShape._rawMapping,
            foreignBookId: targetBookShape.foreignBookId,
            readarrBookId: targetBookShape.readarrBookId
          }

          // Cache the fetched book
          await this.cacheBook(book as Book)
          logger.debug('Fetched and cached book from Readarr', { bookId: id })
          return book
        } else {
          logger.debug('Book not found in Readarr', { bookId: id })

          // Check if we have stale cache as fallback
          if (cached.length > 0) {
            logger.debug('Using stale cache as fallback', { bookId: id })
            return this.formatToTargetShape(id, cached[0])
          }

          return null
        }
      } catch (fetchError) {
        logger.error('Failed to fetch book from Readarr', {
          error: fetchError, 
          bookId: id 
        })
        
        // Check if we have any cache as fallback
        if (cached.length > 0) {
          logger.debug('Using cache as fallback after fetch failure', { bookId: id })
          return this.formatToTargetShape(id, cached[0])
        }
        
        return null
      }
    } catch (error) {
      logger.error('Failed to get book by ID', { error: error instanceof Error ? error.message : error, bookId: id })
      throw new Error('Failed to retrieve book')
    }
  }

  /**
   * Get popular books
   */
  static async getPopularBooks(limit = 20): Promise<Book[]> {
    // TODO: Architect Readarr Lists integration for discovery features.
    return []
  }

  /**
   * Get new releases
   */
  static async getNewReleases(limit = 20): Promise<Book[]> {
    // TODO: Architect Readarr Lists integration for discovery features.
    return []
  }
}

import { logger } from '@/lib/utils/logger'
import type {
  Book,
  BookinfoSearchResult,
  BookinfoBook,
  BookinfoWork,
  BookinfoAuthor,
  BookinfoBulkResponse,
} from '@/types/bookinfo'

export class BookinfoService {
  private static apiUrl = 'https://api.bookinfo.pro'

  /**
   * Search for books
   */
  static async searchBooks(query: string, limit = 20): Promise<Book[]> {
    try {
      const response = await fetch(
        `${this.apiUrl}/search?q=${encodeURIComponent(query)}`
      )

      if (!response.ok) {
        throw new Error(`Bookinfo API error: ${response.statusText}`)
      }

      const searchResults: BookinfoSearchResult[] = await response.json()

      if (!searchResults || searchResults.length === 0) {
        return []
      }

      // Get unique book IDs (not work IDs - the bulk endpoint expects book IDs)
      const bookIds = [...new Set(searchResults.map(r => r.bookId))]
        .filter(id => id != null) // Filter out null/undefined
        .slice(0, limit)

      // Fetch detailed info for all books
      const books = await this.getBulkBooks(bookIds)

      return books
    } catch (error) {
      logger.error('Bookinfo search failed', { error, query })
      throw error
    }
  }

  /**
   * Get book by work ID
   */
  static async getBookById(workId: string): Promise<Book | null> {
    try {
      const response = await fetch(`${this.apiUrl}/work/${workId}`)

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`Bookinfo API error: ${response.statusText}`)
      }

      const data: BookinfoBulkResponse = await response.json()

      if (!data.Works || data.Works.length === 0) {
        return null
      }

      return this.transformToBook(data.Works[0], data.Authors)
    } catch (error) {
      logger.error('Failed to get book by ID', { error, workId })
      throw error
    }
  }

  /**
   * Get multiple books by IDs (returns parent works)
   */
  static async getBulkBooks(bookIds: number[]): Promise<Book[]> {
    try {
      logger.debug('Fetching bulk books', { bookIds })

      // Build query string with multiple id parameters
      const queryParams = bookIds.map(id => `id=${id}`).join('&')
      const url = `${this.apiUrl}/book/bulk?${queryParams}`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Bookinfo API error: ${response.statusText}`)
      }

      const data: BookinfoBulkResponse = await response.json()

      logger.debug('Bulk books response', {
        workCount: data.Works?.length,
        workIds: data.Works?.map(w => w.ForeignId),
        titles: data.Works?.map(w => w.Title)
      })

      return data.Works.map(work => this.transformToBook(work, data.Authors))
    } catch (error) {
      logger.error('Failed to get bulk books', { error, bookIds })
      throw error
    }
  }

  /**
   * Get popular/recommended books
   * Since the /recommended endpoint returns empty workIds, we use curated search terms
   */
  static async getRecommendedBooks(limit = 20): Promise<Book[]> {
    try {
      // Use popular search terms to get diverse popular books
      const searchTerms = ['bestseller', 'popular', 'award winner', 'classic']
      const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)]

      return await this.searchBooks(randomTerm, limit)
    } catch (error) {
      logger.error('Failed to get recommended books', { error })
      throw error
    }
  }

  /**
   * Get new release books
   * Uses search with recent publication dates
   */
  static async getNewReleases(limit = 20): Promise<Book[]> {
    try {
      // Search for books published recently
      const currentYear = new Date().getFullYear()
      const searchTerms = [
        `${currentYear}`,
        `new release ${currentYear}`,
        `${currentYear - 1}`,
      ]
      const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)]

      return await this.searchBooks(randomTerm, limit)
    } catch (error) {
      logger.error('Failed to get new releases', { error })
      throw error
    }
  }

  /**
   * Get books by genre
   * Searches for books matching a specific genre using multiple search variations
   */
  static async getBooksByGenre(genre: string, limit = 100): Promise<Book[]> {
    try {
      logger.debug('Fetching books by genre', { genre, limit })

      // Create multiple search queries to get more diverse results
      const searchQueries = [
        genre, // Direct genre name
        `${genre} books`,
        `best ${genre}`,
        `popular ${genre}`,
        `${genre} fiction`,
        `${genre} literature`,
      ]

      // Execute all searches in parallel
      const searchPromises = searchQueries.map(query =>
        this.searchBooks(query, 20).catch(err => {
          logger.error('Genre search query failed', { query, error: err })
          return []
        })
      )

      const searchResults = await Promise.all(searchPromises)

      // Combine and deduplicate all results
      const allBooks = Array.from(
        new Map(
          searchResults.flat().map(book => [book.id, book])
        ).values()
      )

      // Filter to only include books that actually have this genre in their metadata
      const filteredBooks = allBooks.filter(book =>
        book.genres && book.genres.some(g =>
          g.toLowerCase().includes(genre.toLowerCase()) ||
          genre.toLowerCase().includes(g.toLowerCase())
        )
      )

      logger.debug('Books fetched for genre', {
        genre,
        totalFetched: allBooks.length,
        afterFilter: filteredBooks.length,
        queriesUsed: searchQueries.length
      })

      // Return up to limit books
      return filteredBooks.slice(0, limit)
    } catch (error) {
      logger.error('Failed to get books by genre', { error, genre })
      // Don't throw - return empty array to allow other genres to succeed
      return []
    }
  }

  /**
   * Transform bookinfo data to our Book type
   */
  private static transformToBook(
    work: BookinfoWork,
    authors: BookinfoAuthor[]
  ): Book {
    // Get the primary book edition
    const primaryBook = work.Books?.[0]

    // Get author IDs from book's contributors
    const contributorIds = primaryBook?.Contributors?.map(c => c.ForeignId) || []

    // Get author names from the authors array
    const authorObjects = authors.filter(a => contributorIds.includes(a.ForeignId))
    const authorNames = authorObjects.map(a => a.Name)
    const primaryAuthor = authorNames[0] || 'Unknown Author'

    // Get series info
    const primarySeries = work.Series?.find(s => s.Primary)

    return {
      id: work.ForeignId.toString(),
      title: work.Title,
      subtitle: work.FullTitle !== work.Title ? work.FullTitle : undefined,
      description: primaryBook?.Description,
      coverImage: primaryBook?.ImageUrl,
      author: primaryAuthor,
      authors: authorNames,
      isbn: primaryBook?.Isbn13,
      isbn13: primaryBook?.Isbn13,
      pageCount: primaryBook?.NumPages,
      publishedDate: work.ReleaseDateRaw || work.ReleaseDate,
      publisher: primaryBook?.Publisher,
      rating: work.AverageRating, // Rating is at work level
      series: primarySeries ? authors.find(a => false)?.Name : undefined, // Series name not in work object
      seriesPosition: primarySeries?.SeriesPosition,
      genres: work.Genres || [],
    }
  }
}

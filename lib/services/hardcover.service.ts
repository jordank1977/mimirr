import {
  type HardcoverBook,
  type HardcoverSearchResponse,
  type HardcoverBookResponse,
  type Book,
  transformHardcoverBook,
} from '@/types/hardcover'
import { logger } from '@/lib/utils/logger'

export class HardcoverService {
  private static apiUrl = 'https://api.hardcover.app/v1/graphql'
  private static apiToken = process.env.HARDCOVER_API_TOKEN

  /**
   * Make a GraphQL request to Hardcover API
   */
  private static async query<T>(
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<T> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (this.apiToken) {
        headers['Authorization'] = `Bearer ${this.apiToken}`
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
      })

      if (!response.ok) {
        throw new Error(`Hardcover API error: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.errors) {
        logger.error('Hardcover GraphQL errors', { errors: result.errors })
        throw new Error('Hardcover API returned errors')
      }

      return result.data as T
    } catch (error) {
      logger.error('Hardcover API request failed', { error })
      throw error
    }
  }

  /**
   * Search for books by query
   */
  static async searchBooks(searchQuery: string, limit = 20): Promise<Book[]> {
    if (!this.apiToken) {
      logger.warn('Hardcover API token not configured - returning empty results')
      return []
    }

    try {
      // For partial matching, try using _similar or _iregex instead of _ilike
      const query = `
        query SearchBooks($title: String!, $limit: Int!) {
          books(
            where: { title: { _iregex: $title } }
            limit: $limit
            order_by: { users_count: desc }
          ) {
            id
            title
            description
            slug
            cached_contributors
            cached_tags
            contributions {
              author {
                name
              }
            }
          }
        }
      `

      // Use case-insensitive regex for partial matching
      const variables = {
        title: searchQuery,
        limit: limit,
      }

      const data = await this.query<HardcoverSearchResponse>(query, variables)
      return data.books.map(transformHardcoverBook)
    } catch (error) {
      logger.error('Search books failed', { error, searchQuery })
      throw error
    }
  }

  /**
   * Get book by ID
   */
  static async getBookById(id: string): Promise<Book | null> {
    const query = `
      query GetBook($id: Int!) {
        books(where: { id: { _eq: $id } }) {
          id
          title
          description
          slug
          cached_contributors
          cached_tags
          contributions {
            author {
              name
            }
          }
        }
      }
    `

    const variables = { id: parseInt(id) }

    const data = await this.query<HardcoverBookResponse>(query, variables)

    if (data.books.length === 0) {
      return null
    }

    return transformHardcoverBook(data.books[0])
  }

  /**
   * Get popular books
   */
  static async getPopularBooks(limit = 20): Promise<Book[]> {
    if (!this.apiToken) {
      logger.warn('Hardcover API token not configured - returning empty results')
      return []
    }

    const query = `
      query GetPopularBooks($limit: Int!) {
        books(
          limit: $limit
          order_by: { users_count: desc }
        ) {
          id
          title
          description
          slug
          cached_contributors
          cached_tags
          contributions {
            author {
              name
            }
          }
        }
      }
    `

    const data = await this.query<HardcoverSearchResponse>(query, { limit })
    return data.books.map(transformHardcoverBook)
  }

  /**
   * Get new releases
   */
  static async getNewReleases(limit = 20): Promise<Book[]> {
    if (!this.apiToken) {
      logger.warn('Hardcover API token not configured - returning empty results')
      return []
    }

    const query = `
      query GetNewReleases($limit: Int!) {
        books(
          limit: $limit
          order_by: { users_count: desc }
        ) {
          id
          title
          description
          slug
          cached_contributors
          cached_tags
          contributions {
            author {
              name
            }
          }
        }
      }
    `

    const data = await this.query<HardcoverSearchResponse>(query, { limit })
    return data.books.map(transformHardcoverBook)
  }
}

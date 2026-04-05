import { logger } from '@/lib/utils/logger'
import { db, settings } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { decrypt } from '@/lib/crypto'

export interface BookLoreConfig {
  url: string
  username: string
  password: string
  libraryId: string
}

export class BookLoreService {
  private static authToken: string | null = null
  private static tokenExpiry: number = 0
  private static TOKEN_DURATION = 60 * 60 * 1000 // 60 minutes

  /**
   * Get BookLore configuration from database
   */
  static async getConfig(): Promise<BookLoreConfig | null> {
    try {
      const urlSetting = await db
        .select()
        .from(settings)
        .where(eq(settings.key, 'booklore_url'))
        .limit(1)

      const usernameSetting = await db
        .select()
        .from(settings)
        .where(eq(settings.key, 'booklore_username'))
        .limit(1)

      const passwordSetting = await db
        .select()
        .from(settings)
        .where(eq(settings.key, 'booklore_password'))
        .limit(1)

      const libraryIdSetting = await db
        .select()
        .from(settings)
        .where(eq(settings.key, 'booklore_library_id'))
        .limit(1)

      if (!urlSetting[0] || !usernameSetting[0] || !passwordSetting[0] || !libraryIdSetting[0]) {
        return null
      }

      // Decrypt the stored password, safely handling legacy plaintext passwords by returning ''
      const rawPassword = passwordSetting[0].value
      const decryptedPassword = rawPassword ? decrypt(rawPassword) : ''

      return {
        url: urlSetting[0].value,
        username: usernameSetting[0].value,
        password: decryptedPassword,
        libraryId: libraryIdSetting[0].value,
      }
    } catch (error) {
      logger.error('Failed to get BookLore configuration', { error: error instanceof Error ? error.message : error })
      return null
    }
  }

  /**
   * Authenticate with BookLore and get JWT token
   */
  private static async authenticate(config: BookLoreConfig): Promise<string | null> {
    try {
      const now = Date.now()
      
      // Check if we have a valid cached token
      if (this.authToken && now < this.tokenExpiry) {
        logger.debug('Using cached BookLore auth token')
        return this.authToken
      }

      const baseUrl = config.url.replace(/\/$/, '')
      const authUrl = `${baseUrl}/api/v1/auth/login`
      
      logger.info('Attempting BookLore login', { url: authUrl, username: config.username })

      // Create AbortController for timeout handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      try {
        const response = await fetch(authUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: config.username,
            password: config.password,
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const responseText = await response.text()
        
        if (!response.ok) {
          logger.error('BookLore authentication failed', {
            status: response.status,
            error: responseText.substring(0, 200),
            url: authUrl,
          })
          return null
        }

        try {
          const authData = JSON.parse(responseText)
          const token = authData.token || authData.accessToken

          if (!token) {
            logger.error('No token in BookLore authentication response', { authData })
            return null
          }

          // Cache the token
          this.authToken = token
          this.tokenExpiry = now + this.TOKEN_DURATION

          logger.info('BookLore authentication successful')
          return token
        } catch (e) {
          logger.error('Failed to parse BookLore authentication response as JSON', {
            rawResponse: responseText.substring(0, 200),
            url: authUrl,
          })
          return null
        }
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          logger.error('BookLore connection timed out after 8s', { url: authUrl })
          throw new Error('BookLore connection timed out after 8 seconds')
        }
        throw error
      }
    } catch (error) {
      logger.error('BookLore authentication error', { error: error instanceof Error ? error.message : error })
      return null
    }
  }

  /**
   * Get authenticated headers for BookLore API requests
   */
  private static async getAuthHeaders(config: BookLoreConfig): Promise<Record<string, string> | null> {
    const token = await this.authenticate(config)
    if (!token) {
      return null
    }

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Test connection to BookLore
   */
  static async testConnection(config: BookLoreConfig): Promise<boolean> {
    try {
      const headers = await this.getAuthHeaders(config)
      if (!headers) {
        logger.error('BookLore connection test failed: authentication failed')
        return false
      }

      const baseUrl = config.url.replace(/\/$/, '')
      const testUrl = `${baseUrl}/api/v1/system/status`

      logger.info('Testing BookLore connection', { url: testUrl })

      // Create AbortController for timeout handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      try {
        const response = await fetch(testUrl, {
          headers,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const responseText = await response.text()
        
        if (!response.ok) {
          logger.error('BookLore connection test failed', {
            status: response.status,
            error: responseText.substring(0, 200),
            url: testUrl,
          })
          return false
        }

        logger.info('BookLore connection test successful', { url: testUrl })
        return true
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          logger.error('BookLore connection test timed out after 8s', { url: testUrl })
          return false
        }
        throw error
      }
    } catch (error) {
      logger.error('BookLore connection test failed', { error: error instanceof Error ? error.message : error })
      return false
    }
  }

  /**
   * Refresh a library in BookLore
   * Calls PUT /api/v1/libraries/{libraryId}/refresh
   */
  static async refreshLibrary(config: BookLoreConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = await this.getAuthHeaders(config)
      if (!headers) {
        logger.error('Failed to refresh BookLore library: authentication failed', { libraryId: config.libraryId })
        return { success: false, error: 'Authentication failed' }
      }

      const baseUrl = config.url.replace(/\/$/, '')
      const refreshUrl = `${baseUrl}/api/v1/libraries/${config.libraryId}/refresh`

      logger.info('Refreshing BookLore library', { url: refreshUrl, libraryId: config.libraryId })

      // Create AbortController for timeout handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      try {
        const response = await fetch(refreshUrl, {
          method: 'PUT',
          headers,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const responseText = await response.text()
        
        if (!response.ok) {
          logger.error('Failed to refresh BookLore library', {
            status: response.status,
            error: responseText.substring(0, 200),
            libraryId: config.libraryId,
            url: refreshUrl,
          })
          return { success: false, error: `Failed to refresh library: ${response.statusText}` }
        }

        // Try to parse response as JSON if there's content
        if (responseText.trim()) {
          try {
            const result = JSON.parse(responseText)
            logger.info('BookLore library refresh successful', { 
              libraryId: config.libraryId,
              response: result 
            })
          } catch (e) {
            // If it's not JSON but response was OK, that's fine
            logger.info('BookLore library refresh successful (non-JSON response)', { 
              libraryId: config.libraryId,
              rawResponse: responseText.substring(0, 200)
            })
          }
        } else {
          logger.info('BookLore library refresh successful (empty response)', { libraryId: config.libraryId })
        }
        
        return { success: true }
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          logger.error('BookLore library refresh timed out after 8s', { url: refreshUrl, libraryId: config.libraryId })
          return { 
            success: false, 
            error: 'BookLore connection timed out after 8 seconds' 
          }
        }
        throw error
      }
    } catch (error) {
      logger.error('Failed to refresh BookLore library', { error: error instanceof Error ? error.message : error, libraryId: config.libraryId })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get library status from BookLore
   */
  static async getLibraryStatus(config: BookLoreConfig): Promise<{ 
    success: boolean; 
    status?: any; 
    error?: string 
  }> {
    try {
      const headers = await this.getAuthHeaders(config)
      if (!headers) {
        logger.error('Failed to get BookLore library status: authentication failed', { libraryId: config.libraryId })
        return { success: false, error: 'Authentication failed' }
      }

      const baseUrl = config.url.replace(/\/$/, '')
      const statusUrl = `${baseUrl}/api/v1/libraries/${config.libraryId}`

      logger.info('Getting BookLore library status', { url: statusUrl, libraryId: config.libraryId })

      // Create AbortController for timeout handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      try {
        const response = await fetch(statusUrl, {
          headers,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const responseText = await response.text()
        
        if (!response.ok) {
          logger.error('Failed to get BookLore library status', {
            status: response.status,
            error: responseText.substring(0, 200),
            libraryId: config.libraryId,
            url: statusUrl,
          })
          return { success: false, error: `Failed to get library status: ${response.statusText}` }
        }

        try {
          const status = JSON.parse(responseText)
          logger.info('Successfully retrieved BookLore library status', { libraryId: config.libraryId })
          return { success: true, status }
        } catch (e) {
          logger.error('Failed to parse BookLore library status response as JSON', {
            rawResponse: responseText.substring(0, 200),
            libraryId: config.libraryId,
            url: statusUrl,
          })
          return { success: false, error: 'Invalid response format from BookLore' }
        }
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          logger.error('BookLore library status request timed out after 8s', { url: statusUrl, libraryId: config.libraryId })
          return { 
            success: false, 
            error: 'BookLore connection timed out after 8 seconds' 
          }
        }
        throw error
      }
    } catch (error) {
      logger.error('Failed to get BookLore library status', { error: error instanceof Error ? error.message : error, libraryId: config.libraryId })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Search for books in BookLore
   */
  static async searchBooks(
    config: BookLoreConfig,
    query: string
  ): Promise<{ success: boolean; books?: any[]; error?: string }> {
    try {
      const headers = await this.getAuthHeaders(config)
      if (!headers) {
        logger.error('Failed to search books in BookLore: authentication failed', { query })
        return { success: false, error: 'Authentication failed' }
      }

      const baseUrl = config.url.replace(/\/$/, '')
      const searchUrl = `${baseUrl}/api/v1/books/search?q=${encodeURIComponent(query)}`

      logger.info('Searching books in BookLore', { url: searchUrl, query })

      // Create AbortController for timeout handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      try {
        const response = await fetch(searchUrl, {
          headers,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const responseText = await response.text()
        
        if (!response.ok) {
          logger.error('Failed to search books in BookLore', {
            status: response.status,
            error: responseText.substring(0, 200),
            query,
            url: searchUrl,
          })
          return { success: false, error: `Failed to search books: ${response.statusText}` }
        }

        try {
          const books = JSON.parse(responseText)
          logger.info('Successfully searched books in BookLore', { query, bookCount: books?.length || 0 })
          return { success: true, books }
        } catch (e) {
          logger.error('Failed to parse BookLore search response as JSON', {
            rawResponse: responseText.substring(0, 200),
            query,
            url: searchUrl,
          })
          return { success: false, error: 'Invalid response format from BookLore' }
        }
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          logger.error('BookLore search request timed out after 8s', { url: searchUrl, query })
          return { 
            success: false, 
            error: 'BookLore connection timed out after 8 seconds' 
          }
        }
        throw error
      }
    } catch (error) {
      logger.error('Failed to search books in BookLore', { error: error instanceof Error ? error.message : error, query })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get book details from BookLore
   */
  static async getBookDetails(
    config: BookLoreConfig,
    bookId: string
  ): Promise<{ success: boolean; book?: any; error?: string }> {
    try {
      const headers = await this.getAuthHeaders(config)
      if (!headers) {
        logger.error('Failed to get book details from BookLore: authentication failed', { bookId })
        return { success: false, error: 'Authentication failed' }
      }

      const baseUrl = config.url.replace(/\/$/, '')
      const bookUrl = `${baseUrl}/api/v1/books/${bookId}`

      logger.info('Getting book details from BookLore', { url: bookUrl, bookId })

      // Create AbortController for timeout handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      try {
        const response = await fetch(bookUrl, {
          headers,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const responseText = await response.text()
        
        if (!response.ok) {
          logger.error('Failed to get book details from BookLore', {
            status: response.status,
            error: responseText.substring(0, 200),
            bookId,
            url: bookUrl,
          })
          return { success: false, error: `Failed to get book details: ${response.statusText}` }
        }

        try {
          const book = JSON.parse(responseText)
          logger.info('Successfully retrieved book details from BookLore', { bookId })
          return { success: true, book }
        } catch (e) {
          logger.error('Failed to parse BookLore book details response as JSON', {
            rawResponse: responseText.substring(0, 200),
            bookId,
            url: bookUrl,
          })
          return { success: false, error: 'Invalid response format from BookLore' }
        }
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          logger.error('BookLore book details request timed out after 8s', { url: bookUrl, bookId })
          return { 
            success: false, 
            error: 'BookLore connection timed out after 8 seconds' 
          }
        }
        throw error
      }
    } catch (error) {
      logger.error('Failed to get book details from BookLore', { error: error instanceof Error ? error.message : error, bookId })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
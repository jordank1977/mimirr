import { logger } from '@/lib/utils/logger'
import { db, qualityProfileConfigs } from '@/lib/db'
import { eq } from 'drizzle-orm'

export interface BookshelfConfig {
  url: string
  apiKey: string
}

export interface QualityProfile {
  id: number
  name: string
  upgradeAllowed: boolean
  cutoff: number
}

export class BookshelfService {
  /**
   * Test connection to Bookshelf
   */
  static async testConnection(config: BookshelfConfig): Promise<boolean> {
    try {
      const response = await fetch(`${config.url}/api/v3/system/status`, {
        headers: {
          'X-Api-Key': config.apiKey,
        },
      })

      return response.ok
    } catch (error) {
      logger.error('Bookshelf connection test failed', { error })
      return false
    }
  }

  /**
   * Check if a book already exists in the Bookshelf library
   * Returns the book's status if found, null if not in library
   */
  static async checkBookInLibrary(
    config: BookshelfConfig,
    bookTitle: string,
    authorName: string
  ): Promise<{
    exists: boolean
    status?: 'available' | 'downloading' | 'missing'
    bookFileCount?: number
    format?: string
  }> {
    try {
      const baseUrl = config.url.replace(/\/$/, '')

      // Get all books from the library
      const url = `${baseUrl}/api/v1/book`

      logger.info('Checking book in Bookshelf library', {
        url,
        bookTitle,
        authorName,
      })

      const response = await fetch(url, {
        headers: {
          'X-Api-Key': config.apiKey,
        },
      })

      if (!response.ok) {
        logger.error('Failed to fetch books from Bookshelf library', {
          status: response.status,
          statusText: response.statusText,
        })
        return { exists: false }
      }

      const books = await response.json()

      logger.info('Fetched books from Bookshelf', {
        bookCount: books.length,
        searchTitle: bookTitle,
        searchAuthor: authorName,
      })

      // Search for the book by title and author
      const normalizedTitle = bookTitle.toLowerCase().trim()
      const normalizedAuthor = authorName.toLowerCase().trim()

      logger.debug('Searching for book in library', {
        normalizedTitle,
        normalizedAuthor,
        sampleTitles: books.slice(0, 5).map((b: any) => ({
          title: b.title,
          author: b.author?.authorName,
        })),
      })

      // First, find all books that match the title
      const titleMatches = books.filter((book: any) => {
        const bookTitle = book.title?.toLowerCase().trim()
        return bookTitle === normalizedTitle || bookTitle?.includes(normalizedTitle)
      })

      if (titleMatches.length > 0) {
        logger.info('Found books matching title', {
          count: titleMatches.length,
          matches: titleMatches.map((b: any) => ({
            title: b.title,
            author: b.author?.authorName,
            fileCount: b.statistics?.bookFileCount,
          })),
        })
      }

      // Try to find exact match with title and author
      const matchingBook = titleMatches.find((book: any) => {
        const bookAuthor = book.author?.authorName?.toLowerCase().trim() || ''
        // More flexible author matching
        return bookAuthor === normalizedAuthor ||
               bookAuthor.includes(normalizedAuthor) ||
               normalizedAuthor.includes(bookAuthor)
      })

      // If no exact author match but we have title matches, use the first one
      // (assuming the title is unique enough)
      const finalMatch = matchingBook || (titleMatches.length === 1 ? titleMatches[0] : null)

      if (!finalMatch) {
        logger.info('Book not found in Bookshelf library', {
          searchTitle: bookTitle,
          searchAuthor: authorName,
        })
        return { exists: false }
      }

      // Check if the book has files downloaded
      const bookFileCount = finalMatch.statistics?.bookFileCount || 0

      logger.info('Book found in Bookshelf library', {
        title: finalMatch.title,
        author: finalMatch.author?.authorName,
        bookFileCount,
        grabbed: finalMatch.grabbed,
        monitored: finalMatch.monitored,
      })

      if (bookFileCount > 0) {
        // Fetch book files to get format information
        let format: string | undefined
        try {
          const bookFileUrl = `${baseUrl}/api/v1/bookfile?bookId=${finalMatch.id}`
          logger.debug('Fetching book files for format info', { url: bookFileUrl, bookId: finalMatch.id })

          const bookFileResponse = await fetch(bookFileUrl, {
            headers: {
              'X-Api-Key': config.apiKey,
            },
          })

          if (bookFileResponse.ok) {
            const bookFiles = await bookFileResponse.json()
            if (bookFiles.length > 0) {
              // Get format from first book file (most recent or primary)
              format = bookFiles[0]?.quality?.quality?.name
              logger.info('Book format retrieved', {
                bookId: finalMatch.id,
                format,
                fileCount: bookFiles.length
              })
            }
          } else {
            logger.warn('Failed to fetch book files for format', {
              status: bookFileResponse.status,
              bookId: finalMatch.id,
            })
          }
        } catch (error) {
          logger.warn('Error fetching book file format', { error, bookId: finalMatch.id })
          // Continue without format info - not critical
        }

        return {
          exists: true,
          status: 'available',
          bookFileCount,
          format,
        }
      }

      if (finalMatch.grabbed === true) {
        return {
          exists: true,
          status: 'downloading',
          bookFileCount: 0,
        }
      }

      return {
        exists: true,
        status: 'missing',
        bookFileCount: 0,
      }
    } catch (error) {
      logger.error('Failed to check book in Bookshelf library', {
        error,
        bookTitle,
        authorName,
      })
      // Return false on error to avoid blocking requests
      return { exists: false }
    }
  }

  /**
   * Get quality profiles from Bookshelf
   */
  static async getQualityProfiles(
    config: BookshelfConfig
  ): Promise<QualityProfile[]> {
    try {
      // Remove trailing slash from URL to prevent double slashes
      const baseUrl = config.url.replace(/\/$/, '')
      const url = `${baseUrl}/api/v1/qualityprofile`
      logger.debug('Fetching quality profiles', { url })

      const response = await fetch(url, {
        headers: {
          'X-Api-Key': config.apiKey,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('Failed to fetch quality profiles', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          url,
        })
        return []
      }

      const profiles = await response.json()
      logger.debug('Quality profiles fetched', { count: profiles.length })
      return profiles
    } catch (error) {
      logger.error('Failed to fetch quality profiles', {
        error: error instanceof Error ? error.message : String(error),
        url: `${config.url.replace(/\/$/, '')}/api/v1/qualityprofile`,
      })
      return []
    }
  }

  /**
   * Lookup an author in Bookshelf's metadata provider
   */
  static async lookupAuthor(
    config: BookshelfConfig,
    authorName: string
  ): Promise<any[]> {
    try {
      const baseUrl = config.url.replace(/\/$/, '')
      const url = `${baseUrl}/api/v1/author/lookup?term=${encodeURIComponent(authorName)}`
      logger.debug('Looking up author in Bookshelf', { url, authorName })

      const response = await fetch(url, {
        headers: {
          'X-Api-Key': config.apiKey,
        },
      })

      if (!response.ok) {
        logger.error('Failed to lookup author in Bookshelf', {
          status: response.status,
          authorName,
        })
        return []
      }

      const results = await response.json()
      logger.debug('Author lookup results', { count: results.length })
      return results
    } catch (error) {
      logger.error('Failed to lookup author in Bookshelf', { error, authorName })
      return []
    }
  }

  /**
   * Get root folders from Bookshelf
   */
  static async getRootFolders(config: BookshelfConfig): Promise<any[]> {
    try {
      const baseUrl = config.url.replace(/\/$/, '')
      const url = `${baseUrl}/api/v1/rootFolder`

      const response = await fetch(url, {
        headers: {
          'X-Api-Key': config.apiKey,
        },
      })

      if (!response.ok) {
        logger.error('Failed to get root folders', { status: response.status })
        return []
      }

      const folders = await response.json()
      return folders
    } catch (error) {
      logger.error('Failed to get root folders', { error })
      return []
    }
  }

  /**
   * Add a book to Bookshelf
   */
  static async addBook(
    config: BookshelfConfig,
    bookData: {
      title: string
      author: string
      isbn?: string
      monitored?: boolean
      qualityProfileId: number
    }
  ): Promise<{ success: boolean; bookshelfId?: number; error?: string }> {
    try {
      // Step 1: Lookup the AUTHOR to get foreignAuthorId
      const authorResults = await this.lookupAuthor(config, bookData.author)

      if (authorResults.length === 0) {
        logger.error('Author not found in Bookshelf metadata', {
          author: bookData.author,
        })
        return {
          success: false,
          error: 'Author not found in metadata provider',
        }
      }

      const authorMetadata = authorResults[0]
      logger.debug('Author lookup successful', {
        authorName: authorMetadata.authorName,
        foreignAuthorId: authorMetadata.foreignAuthorId,
      })

      // Step 2: Lookup the specific BOOK to get its foreignBookId
      const baseUrl = config.url.replace(/\/$/, '')
      const bookSearchQuery = bookData.isbn || `${bookData.title}`
      const bookLookupUrl = `${baseUrl}/api/v1/book/lookup?term=${encodeURIComponent(bookSearchQuery)}`

      logger.debug('Looking up book', { url: bookLookupUrl })

      const bookResponse = await fetch(bookLookupUrl, {
        headers: {
          'X-Api-Key': config.apiKey,
        },
      })

      if (!bookResponse.ok) {
        return {
          success: false,
          error: 'Failed to lookup book',
        }
      }

      const bookResults = await bookResponse.json()

      // Helper function to normalize titles for matching
      const normalizeTitle = (title: string): string => {
        return title
          .toLowerCase()
          .split(':')[0] // Remove subtitle (text after colon)
          .trim()
          .replace(/[^\w\s]/g, '') // Remove special characters
          .replace(/\s+/g, ' ') // Normalize whitespace
      }

      // Try multiple matching strategies
      const searchTitle = bookData.title
      const normalizedSearch = normalizeTitle(searchTitle)

      const bookMatch = bookResults.find((book: any) => {
        const bookTitle = book.title
        const normalizedBook = normalizeTitle(bookTitle)

        // Strategy 1: Exact match (case insensitive)
        if (bookTitle.toLowerCase() === searchTitle.toLowerCase()) {
          return true
        }

        // Strategy 2: Exact match on normalized titles (without subtitles)
        if (normalizedBook === normalizedSearch) {
          return true
        }

        // Strategy 3: Either title contains the other (bidirectional)
        if (
          bookTitle.toLowerCase().includes(searchTitle.toLowerCase()) ||
          searchTitle.toLowerCase().includes(bookTitle.toLowerCase())
        ) {
          return true
        }

        // Strategy 4: Normalized titles contain each other
        if (
          normalizedBook.includes(normalizedSearch) ||
          normalizedSearch.includes(normalizedBook)
        ) {
          return true
        }

        return false
      })

      if (!bookMatch) {
        logger.error('Book not found', {
          title: bookData.title,
          normalizedTitle: normalizedSearch,
          searchedTitles: bookResults.map((b: any) => b.title).slice(0, 5)
        })
        return {
          success: false,
          error: 'Book not found in metadata',
        }
      }

      logger.debug('Book lookup successful', {
        title: bookMatch.title,
        foreignBookId: bookMatch.foreignBookId,
      })

      // Step 3: Get root folder
      const rootFolders = await this.getRootFolders(config)
      if (rootFolders.length === 0) {
        return {
          success: false,
          error: 'No root folder configured in Bookshelf',
        }
      }

      const rootFolderPath = rootFolders[0].path

      // Step 4: Add the AUTHOR with specific book monitoring
      // Bookshelf will fetch all the author's books from metadata,
      // but only monitor the one we specify in booksToMonitor
      const authorToAdd = {
        foreignAuthorId: authorMetadata.foreignAuthorId,
        authorName: authorMetadata.authorName,
        qualityProfileId: bookData.qualityProfileId,
        metadataProfileId: 1,
        monitored: true,
        rootFolderPath: rootFolderPath,
        addOptions: {
          monitor: 'none', // Don't auto-monitor new books - only monitor books in booksToMonitor
          searchForMissingBooks: true,
          monitored: true,
          booksToMonitor: [bookMatch.foreignBookId], // Only monitor this specific book
        },
      }

      logger.debug('Adding author to Bookshelf', {
        authorName: authorToAdd.authorName,
        foreignAuthorId: authorToAdd.foreignAuthorId,
        booksToMonitor: authorToAdd.addOptions.booksToMonitor,
      })

      const response = await fetch(`${baseUrl}/api/v1/author`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': config.apiKey,
        },
        body: JSON.stringify(authorToAdd),
      })

      let data: any

      if (!response.ok) {
        const errorText = await response.text()

        // Check if author already exists
        if (response.status === 400 && errorText.includes('AuthorExistsValidator')) {
          logger.info('Author already exists in Bookshelf, looking up existing author', {
            foreignAuthorId: authorMetadata.foreignAuthorId,
          })

          // Look up the existing author by foreignAuthorId
          const existingAuthors = await this.lookupAuthor(config, authorMetadata.authorName)
          const existingAuthor = existingAuthors.find(
            (a: any) => a.foreignAuthorId === authorMetadata.foreignAuthorId
          )

          if (existingAuthor) {
            data = existingAuthor
            logger.info('Found existing author in Bookshelf', {
              authorId: data.id,
              authorName: authorMetadata.authorName,
            })
          } else {
            logger.error('Author exists but could not be found in lookup', {
              authorName: authorMetadata.authorName,
            })
            return {
              success: false,
              error: 'Author exists but could not be found',
            }
          }
        } else {
          logger.error('Failed to add author to Bookshelf', {
            status: response.status,
            error: errorText,
          })
          return {
            success: false,
            error: `Failed to add author: ${response.statusText}`,
          }
        }
      } else {
        data = await response.json()
      }

      logger.info('Author added to Bookshelf successfully', {
        authorId: data.id,
        authorName: authorMetadata.authorName,
        bookTitle: bookData.title,
      })

      return {
        success: true,
        bookshelfId: data.id,
      }
    } catch (error) {
      logger.error('Failed to add book to Bookshelf', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get status of a specific book from an author in Bookshelf
   * @param config - Bookshelf configuration
   * @param authorId - The author ID in Bookshelf (stored as bookshelfId in requests)
   * @param foreignBookId - The Goodreads book ID we're monitoring
   */
  static async getAuthorBookStatus(
    config: BookshelfConfig,
    authorId: number,
    foreignBookId: string
  ): Promise<{
    status: 'available' | 'downloading' | 'missing' | 'error'
    bookFileCount?: number
    error?: string
  }> {
    try {
      const baseUrl = config.url.replace(/\/$/, '')
      // Get books for this author using the book endpoint
      const url = `${baseUrl}/api/v1/book?authorId=${authorId}`

      logger.debug('Checking book status in Bookshelf', {
        url,
        authorId,
        foreignBookId
      })

      const response = await fetch(url, {
        headers: {
          'X-Api-Key': config.apiKey,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          logger.error('Books not found for author in Bookshelf', { authorId })
          return {
            status: 'error',
            error: 'Books not found for author in Bookshelf'
          }
        }
        logger.error('Failed to get books from Bookshelf', {
          status: response.status,
          authorId
        })
        return {
          status: 'error',
          error: `Failed to get books: ${response.statusText}`
        }
      }

      const books = await response.json()

      // Log the books response
      logger.debug('Books response from Bookshelf', {
        authorId,
        bookCount: books?.length || 0,
        bookIds: books?.map((b: any) => b.foreignBookId) || []
      })

      // Find the specific book
      const book = books?.find(
        (b: any) => b.foreignBookId === foreignBookId
      )

      if (!book) {
        logger.error('Book not found in author books', {
          authorId,
          foreignBookId,
          bookCount: books?.length || 0,
          availableBookIds: books?.map((b: any) => b.foreignBookId) || []
        })
        return {
          status: 'error',
          error: 'Book not found in author books'
        }
      }

      const bookFileCount = book.statistics?.bookFileCount || 0

      logger.debug('Book status retrieved', {
        foreignBookId,
        bookFileCount,
        grabbed: book.grabbed,
        monitored: book.monitored
      })

      // Determine status based on book data
      if (bookFileCount > 0) {
        return {
          status: 'available',
          bookFileCount
        }
      }

      if (book.grabbed === true) {
        return {
          status: 'downloading',
          bookFileCount: 0
        }
      }

      return {
        status: 'missing',
        bookFileCount: 0
      }
    } catch (error) {
      logger.error('Failed to get book status from Bookshelf', {
        error,
        authorId,
        foreignBookId
      })
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Sync quality profiles from Bookshelf to local database
   * Creates/updates profile configs, maintains order for new profiles
   */
  static async syncQualityProfiles(config: BookshelfConfig): Promise<void> {
    try {
      const profiles = await this.getQualityProfiles(config)

      if (profiles.length === 0) {
        logger.warn('No quality profiles found to sync')
        return
      }

      // Get existing configs to determine next order index
      const existingConfigs = await db
        .select()
        .from(qualityProfileConfigs)
        .orderBy(qualityProfileConfigs.orderIndex)

      const existingIds = new Set(existingConfigs.map(c => c.profileId))
      let maxOrderIndex = existingConfigs.length > 0
        ? Math.max(...existingConfigs.map(c => c.orderIndex))
        : -1

      // Sync each profile
      for (const profile of profiles) {
        if (existingIds.has(profile.id)) {
          // Update existing profile name if changed
          await db
            .update(qualityProfileConfigs)
            .set({
              profileName: profile.name,
              updatedAt: new Date()
            })
            .where(eq(qualityProfileConfigs.profileId, profile.id))
        } else {
          // Insert new profile with next order index
          maxOrderIndex++
          await db.insert(qualityProfileConfigs).values({
            profileId: profile.id,
            profileName: profile.name,
            enabled: true,
            orderIndex: maxOrderIndex,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }
      }

      logger.info('Quality profiles synced', { count: profiles.length })
    } catch (error) {
      logger.error('Failed to sync quality profiles', { error })
      throw error
    }
  }

  /**
   * Get all quality profile configurations (for admin management)
   */
  static async getQualityProfileConfigs() {
    try {
      const configs = await db
        .select()
        .from(qualityProfileConfigs)
        .orderBy(qualityProfileConfigs.orderIndex)

      return configs
    } catch (error) {
      logger.error('Failed to get quality profile configs', { error })
      return []
    }
  }

  /**
   * Get enabled quality profiles in order (for request form dropdown)
   */
  static async getEnabledQualityProfiles() {
    try {
      const configs = await db
        .select()
        .from(qualityProfileConfigs)
        .where(eq(qualityProfileConfigs.enabled, true))
        .orderBy(qualityProfileConfigs.orderIndex)

      return configs.map(c => ({
        id: c.profileId,
        name: c.profileName,
      }))
    } catch (error) {
      logger.error('Failed to get enabled quality profiles', { error })
      return []
    }
  }

  /**
   * Update quality profile configuration
   */
  static async updateQualityProfileConfig(
    profileId: number,
    updates: { enabled?: boolean; orderIndex?: number }
  ) {
    try {
      await db
        .update(qualityProfileConfigs)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(qualityProfileConfigs.profileId, profileId))

      logger.info('Quality profile config updated', { profileId, updates })
    } catch (error) {
      logger.error('Failed to update quality profile config', { error, profileId })
      throw error
    }
  }

  /**
   * Reorder quality profiles
   */
  static async reorderQualityProfiles(orderedProfileIds: number[]) {
    try {
      // Update each profile's orderIndex based on position in array
      for (let i = 0; i < orderedProfileIds.length; i++) {
        await db
          .update(qualityProfileConfigs)
          .set({ orderIndex: i, updatedAt: new Date() })
          .where(eq(qualityProfileConfigs.profileId, orderedProfileIds[i]))
      }

      logger.info('Quality profiles reordered', { count: orderedProfileIds.length })
    } catch (error) {
      logger.error('Failed to reorder quality profiles', { error })
      throw error
    }
  }
}

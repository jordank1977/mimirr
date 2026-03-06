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
  private static libraryCache: any[] | null = null
  private static libraryCacheTimestamp: number = 0
  private static CACHE_DURATION = 60 * 1000 // 60 seconds
  private static libraryFetchPromise: Promise<any[]> | null = null

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
      const now = Date.now()
      let books: any[]

      // Check if we have a valid cache
      if (
        this.libraryCache &&
        now - this.libraryCacheTimestamp < this.CACHE_DURATION
      ) {
        logger.debug('Using cached Bookshelf library', {
          count: this.libraryCache.length,
          age: `${((now - this.libraryCacheTimestamp) / 1000).toFixed(1)}s`,
        })
        books = this.libraryCache
      } else if (this.libraryFetchPromise) {
        logger.debug('Waiting for in-progress Bookshelf library fetch')
        books = await this.libraryFetchPromise
      } else {
        // Get all books from the library
        const url = `${baseUrl}/api/v1/book`

        logger.info('Fetching fresh Bookshelf library', {
          url,
          bookTitle,
          authorName,
        })

        this.libraryFetchPromise = (async () => {
          try {
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
              return []
            }

            const data = await response.json()

            // Update cache
            this.libraryCache = data
            this.libraryCacheTimestamp = Date.now()
            logger.debug('Bookshelf library cache updated', { count: data.length })

            return data
          } finally {
            this.libraryFetchPromise = null
          }
        })()

        books = await this.libraryFetchPromise

        if (books.length === 0) {
          return { exists: false }
        }
      }

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

      // Helper function to normalize text for matching (titles, authors)
      const normalizeText = (text: string): string => {
        return text
          .toLowerCase()
          .split(':')[0] // Remove subtitles
          .trim()
          .replace(/[^\w\s]/g, '') // Remove special characters
          .replace(/\s+/g, ' ') // Normalize whitespace
      }

      const normalizedSearchName = normalizeText(authorName)
      const searchWords = normalizedSearchName.split(' ')

      // Filter results to ensure strict author matching
      // We want to avoid "Sara Ackerman" matching "Sara Holly Ackerman"
      // So we require that the result contains exactly the same words as the search,
      // or at least that the search isn't missing any words from the result (or vice-versa for middle names).
      // Actually, middle names are tricky. If user searched "Sara Ackerman", they probably don't want "Sara Holly Ackerman".
      const strictResults = results.filter((author: any) => {
        const normalizedResultName = normalizeText(author.authorName || '')
        const resultWords = normalizedResultName.split(' ')
        
        // Exact match of all words (ignoring order)
        const wordsInResult = searchWords.every(word => resultWords.includes(word))
        const wordsInSearch = resultWords.every(word => searchWords.includes(word))
        
        return wordsInResult && wordsInSearch
      })

      if (strictResults.length > 0) {
        logger.info('Strict author lookup successful', {
          originalCount: results.length,
          strictCount: strictResults.length,
          bestMatch: strictResults[0].authorName
        })
        return strictResults
      }

      // If no strict matches, return nothing to prevent wrong author addition
      logger.warn('No strict author matches found', { 
        authorName, 
        foundAuthors: results.map((a: any) => a.authorName).slice(0, 3) 
      })
      return []
    } catch (error) {
      logger.error('Failed to lookup author in Bookshelf', { error, authorName })
      return []
    }
  }

  /**
   * Search for books using Bookshelf's lookup endpoint
   */
  static async searchBooks(
    config: BookshelfConfig,
    term: string
  ): Promise<any[]> {
    try {
      const baseUrl = config.url.replace(/\/$/, '')
      const url = `${baseUrl}/api/v1/book/lookup?term=${encodeURIComponent(term)}`
      logger.debug('Searching books via Bookshelf lookup', { url, term })

      const response = await fetch(url, {
        headers: {
          'X-Api-Key': config.apiKey,
        },
      })

      if (!response.ok) {
        logger.error('Failed to search books via Bookshelf', {
          status: response.status,
          term,
        })
        return []
      }

      const results = await response.json()
      logger.debug('Bookshelf search results', { count: results.length })
      return results
    } catch (error) {
      logger.error('Failed to search books via Bookshelf', { error, term })
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
      metadata?: any // RAW payload from Bookshelf lookup
    }
  ): Promise<{ success: boolean; bookshelfId?: number; foreignBookId?: string; error?: string }> {
    try {
      const baseUrl = config.url.replace(/\/$/, '')

      let bookMatch = bookData.metadata

      if (!bookMatch) {
        // Step 1: Lookup the specific BOOK first to get its foreignBookId AND foreignAuthorId
        // This is much more accurate than an isolated author search, as book titles + ISBNs are unique.
        
        // Use ISBN if available, otherwise use "Title Author" for much better accuracy and speed
        // Normalize whitespace in the search query to avoid issues with double spaces
        const normalizedAuthorInput = bookData.author.replace(/\s+/g, ' ').trim()
        const bookSearchQuery = bookData.isbn || `${bookData.title} ${normalizedAuthorInput}`
        const bookLookupUrl = `${baseUrl}/api/v1/book/lookup?term=${encodeURIComponent(bookSearchQuery)}`

        logger.debug('Looking up book', { 
          url: bookLookupUrl, 
          searchTerm: bookSearchQuery,
          usingIsbn: !!bookData.isbn 
        })

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

        let bookResults = await bookResponse.json()

        // Fallback: If ISBN search returned no results, try searching by title + author
        if (bookResults.length === 0 && bookData.isbn) {
          logger.info('Book not found by ISBN, falling back to title + author search', {
            isbn: bookData.isbn,
            title: bookData.title,
            author: bookData.author
          })

          const fallbackQuery = `${bookData.title} ${normalizedAuthorInput}`
          const fallbackUrl = `${baseUrl}/api/v1/book/lookup?term=${encodeURIComponent(fallbackQuery)}`
          const fallbackResponse = await fetch(fallbackUrl, {
            headers: {
              'X-Api-Key': config.apiKey,
            },
          })

          if (fallbackResponse.ok) {
            bookResults = await fallbackResponse.json()
            logger.debug('Title fallback search results', { count: bookResults.length })
          } else {
            logger.warn('Title fallback search failed', {
              status: fallbackResponse.status,
              title: bookData.title
            })
          }
        }

        // Helper function to normalize text for matching (titles, authors)
        const normalizeText = (text: string): string => {
          return text
            .toLowerCase()
            .split(':')[0] // Remove subtitles
            .trim()
            .replace(/[^\w\s]/g, '') // Remove special characters
            .replace(/\s+/g, ' ') // Normalize whitespace
        }

        // Try multiple matching strategies
        const searchTitle = bookData.title
        const normalizedSearchTitle = normalizeText(searchTitle)
        const normalizedSearchAuthor = normalizeText(bookData.author)

        bookMatch = bookResults.find((book: any) => {
          const bookTitle = book.title
          const normalizedBookTitle = normalizeText(bookTitle)
          
          // CRITICAL: Ensure the author matches too!
          // Bookshelf/Readarr returns author info in author.authorName or authorName
          const resultAuthorName = (book.author?.authorName || book.authorName || '')
          const normalizedResultAuthor = normalizeText(resultAuthorName)
          
          // Stricter author matching: Normalized names should contain each other
          // We check if the search term words are all present in the result author name
          const searchWords = normalizedSearchAuthor.split(' ')
          const resultWords = normalizedResultAuthor.split(' ')
          
          const allWordsMatch = searchWords.every(word => resultWords.includes(word))
          
          // Also ensure the result isn't just a tiny subset of the search
          const authorMatches = allWordsMatch || normalizedSearchAuthor.includes(normalizedResultAuthor)

          if (!authorMatches) {
            return false
          }

          // Strategy 1: Exact match (case insensitive)
          if (bookTitle.toLowerCase() === searchTitle.toLowerCase()) {
            return true
          }

          // Strategy 2: Exact match on normalized titles (without subtitles)
          if (normalizedBookTitle === normalizedSearchTitle) {
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
            normalizedBookTitle.includes(normalizedSearchTitle) ||
            normalizedSearchTitle.includes(normalizedBookTitle)
          ) {
            return true
          }

          return false
        })
      }

      if (!bookMatch) {
        logger.error('Book not found in Bookshelf metadata', {
          title: bookData.title,
          author: bookData.author,
          isbn: bookData.isbn
        })
        return {
          success: false,
          error: 'Book not found in metadata',
        }
      }

      logger.debug('Book lookup successful', {
        title: bookMatch.title,
        foreignBookId: bookMatch.foreignBookId,
        authorInBookMatch: bookMatch.author?.authorName || bookMatch.authorName,
        foreignAuthorIdInBookMatch: bookMatch.author?.foreignAuthorId || bookMatch.foreignAuthorId
      })

      // Step 2: Use the exact author metadata from the matched book
      // This ensures we add the correct author profile that actually contains this book.
      let authorMetadata = {
        foreignAuthorId: bookMatch.author?.foreignAuthorId || bookMatch.foreignAuthorId,
        authorName: bookMatch.author?.authorName || bookMatch.authorName
      }

      if (!authorMetadata.foreignAuthorId) {
        // Fallback: If the book match didn't have author ID, we MUST lookup the author
        const authorResults = await this.lookupAuthor(config, bookData.author)
        if (authorResults.length === 0) {
          logger.error('Author not found in Bookshelf metadata after book match', {
            author: bookData.author,
          })
          return {
            success: false,
            error: 'Author not found in metadata provider',
          }
        }
        authorMetadata = authorResults[0]
      }

      logger.info('Determined correct author metadata for addition', {
        authorName: authorMetadata.authorName,
        foreignAuthorId: authorMetadata.foreignAuthorId,
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
          monitored: true, // Ensure the author is added as Monitored
          rootFolderPath: rootFolderPath,
          addOptions: {
            // As seen in Readarr's getNewBook.js frontend logic, when monitoring a specific book,
            // 'monitor' is omitted from addOptions, and we rely purely on 'booksToMonitor'.
            searchForMissingBooks: true,
            booksToMonitor: [bookMatch.foreignBookId],
          },
          // Standard Readarr field for "Monitor New Books"
          monitorNewItems: 'none',
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
            logger.info('Found existing author in Bookshelf, ensuring author and book are monitored', {
              authorId: data.id,
              authorName: authorMetadata.authorName,
              foreignBookId: bookMatch.foreignBookId,
            })

            // Ensure author is monitored and has correct quality profile
            if (!data.monitored || data.qualityProfileId !== bookData.qualityProfileId) {
              logger.info('Updating existing author monitoring/profile', {
                authorId: data.id,
                monitored: true,
                qualityProfileId: bookData.qualityProfileId
              })
              data.monitored = true
              data.qualityProfileId = bookData.qualityProfileId
              await fetch(`${baseUrl}/api/v1/author`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Api-Key': config.apiKey,
                },
                body: JSON.stringify(data),
              })
            }

            // If author exists, we need to make sure the specific book is monitored
            // First, find the book in the author's books
            const authorBooksResponse = await fetch(`${baseUrl}/api/v1/book?authorId=${data.id}`, {
              headers: { 'X-Api-Key': config.apiKey },
            })

            if (authorBooksResponse.ok) {
              const authorBooks = await authorBooksResponse.json()
              const existingBook = authorBooks.find((b: any) => b.foreignBookId === bookMatch.foreignBookId)

              if (existingBook) {
                if (!existingBook.monitored) {
                  logger.info('Monitoring existing book for existing author', {
                    bookId: existingBook.id,
                    title: existingBook.title,
                  })
                  
                  existingBook.monitored = true
                  await fetch(`${baseUrl}/api/v1/book`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Api-Key': config.apiKey,
                    },
                    body: JSON.stringify(existingBook),
                  })
                }
              } else {
                logger.info('Book not found for existing author, triggering refresh', {
                  authorId: data.id,
                  authorName: authorMetadata.authorName,
                })
                // Trigger refresh if book not found
                await fetch(`${baseUrl}/api/v1/command`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': config.apiKey,
                  },
                  body: JSON.stringify({
                    name: 'RefreshAuthor',
                    authorId: data.id,
                  }),
                })
              }
            }
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
        
        // Trigger an explicit refresh for the new author to ensure books are populated
        logger.info('Triggering refresh for new author', {
          authorId: data.id,
          authorName: authorMetadata.authorName,
        })
        
        await fetch(`${baseUrl}/api/v1/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': config.apiKey,
          },
          body: JSON.stringify({
            name: 'RefreshAuthor',
            authorId: data.id,
          }),
        }).catch(err => logger.error('Failed to trigger refresh for new author', { error: err }))
      }

      logger.info('Author added/verified in Bookshelf successfully', {
        authorId: data.id,
        authorName: authorMetadata.authorName,
        bookTitle: bookData.title,
      })

      // Step 5: Explicitly verify and add the BOOK if missing
      // This bypasses metadata provider latency/caching issues with author book lists
      try {
        logger.debug('Verifying book existence for author', {
          authorId: data.id,
          foreignBookId: bookMatch.foreignBookId
        })

        const authorBooksResponse = await fetch(`${baseUrl}/api/v1/book?authorId=${data.id}`, {
          headers: { 'X-Api-Key': config.apiKey },
        })

        let bookFound = false
        if (authorBooksResponse.ok) {
          const authorBooks = await authorBooksResponse.json()
          const existingBook = authorBooks.find((b: any) => b.foreignBookId === bookMatch.foreignBookId)
          
          if (existingBook) {
            bookFound = true
            logger.info('Book already exists for author, ensuring monitored status', {
              bookId: existingBook.id,
              monitored: existingBook.monitored
            })
            
            if (!existingBook.monitored) {
              existingBook.monitored = true
              await fetch(`${baseUrl}/api/v1/book`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Api-Key': config.apiKey,
                },
                body: JSON.stringify(existingBook),
              })
            }
          }
        }

        if (!bookFound) {
          logger.info('Book missing from author library, explicitly adding book', {
            title: bookMatch.title,
            foreignBookId: bookMatch.foreignBookId,
            authorId: data.id
          })

          // Bookshelf's book/lookup results use top-level foreignEditionId instead of an editions array.
          // We must construct the editions payload using this ID to match Bookshelf's expectations.
          const editionsToPayload = [{
            foreignEditionId: bookMatch.foreignEditionId,
            title: bookMatch.title,
            monitored: true,
            // Ensure required arrays exist to prevent mapping crashes in Bookshelf
            links: bookMatch.links || [],
            formats: bookMatch.formats || [],
            images: bookMatch.images || []
          }];

          const bookToAdd = {
            ...bookMatch,
            authorId: data.id,
            monitored: true,
            editions: editionsToPayload,
            addOptions: {
              searchForNewBook: true // Trigger immediate search
            },
            // Include author info to satisfy Bookshelf's validation
            author: {
              id: data.id,
              foreignAuthorId: authorMetadata.foreignAuthorId,
              authorName: authorMetadata.authorName,
              path: data.path,
              rootFolderPath: data.rootFolderPath
            }
          }

          const addBookResponse = await fetch(`${baseUrl}/api/v1/book`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': config.apiKey,
            },
            body: JSON.stringify(bookToAdd),
          })

          if (addBookResponse.ok) {
            const addedBook = await addBookResponse.json()
            logger.info('Book explicitly added to Bookshelf', {
              bookId: addedBook.id,
              title: addedBook.title
            })
          } else if (addBookResponse.status === 409) {
            logger.info('Book addition failed with 409 Conflict, assuming book already exists and merging', {
              foreignBookId: bookMatch.foreignBookId,
            })
            // If it's a conflict, the book or edition is already there. We can treat this as success.
          } else {
            const errorText = await addBookResponse.text()
            logger.error('Failed to explicitly add book to Bookshelf', {
              status: addBookResponse.status,
              error: errorText,
              foreignBookId: bookMatch.foreignBookId
            })
          }
        }
      } catch (bookError) {
        logger.error('Error during explicit book verification/addition', { 
          error: bookError,
          foreignBookId: bookMatch.foreignBookId 
        })
      }

      return {
        success: true,
        bookshelfId: data.id,
        foreignBookId: bookMatch.foreignBookId,
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

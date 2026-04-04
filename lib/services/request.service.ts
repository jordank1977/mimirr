import { db, requests, users, settings, libraryBooks, bookCache, type Request, type NewRequest } from '@/lib/db'
import { eq, and, desc, isNotNull, lt, sql } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'
import { BookService } from './book.service'
import { BookshelfService } from './bookshelf.service'
import { NotificationService } from './notification.service'

export interface RequestWithBook extends Request {
  bookTitle: string
  bookAuthor: string
  bookCoverImage?: string
  bookPublishedDate?: string
  requestedBy?: string
}

export class RequestService {
  /**
   * Helper function to normalize dates to YYYY-MM-DD
   */
  static formatToYYYYMMDD(dateInput: string | Date | null | undefined): string | null {
    if (!dateInput) return null;
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return null;

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  /**
   * Create a new book request
   */
  static async createRequest(data: {
    userId: number
    bookId: string
    qualityProfileId: number
    notes?: string
  }): Promise<Request> {
    try {
      // Check if user already has a pending/approved request for this book
      const existing = await db
        .select()
        .from(requests)
        .where(
          and(
            eq(requests.userId, data.userId),
            eq(requests.bookId, data.bookId),
            eq(requests.status, 'pending')
          )
        )
        .limit(1)

      if (existing.length > 0) {
        throw new Error('You already have a pending request for this book')
      }

      // Fetch book details to cache them
      await BookService.getBookById(data.bookId)

      const newRequest: NewRequest = {
        userId: data.userId,
        bookId: data.bookId,
        qualityProfileId: data.qualityProfileId,
        notes: data.notes,
        status: 'pending',
        requestedAt: new Date(),
      }

      const result = await db.insert(requests).values(newRequest).returning()

      logger.info('Book request created', {
        requestId: result[0].id,
        userId: data.userId,
        bookId: data.bookId,
        qualityProfileId: data.qualityProfileId,
      })

      return result[0]
    } catch (error) {
      logger.error('Failed to create request', { error: error instanceof Error ? error.message : error, data })
      throw error
    }
  }

  /**
   * Get request by ID
   */
  static async getRequestById(requestId: number): Promise<Request | null> {
    const result = await db
      .select()
      .from(requests)
      .where(eq(requests.id, requestId))
      .limit(1)

    return result[0] || null
  }

  /**
   * Get requests by user ID
   */
  static async getRequestsByUserId(
    userId: number
  ): Promise<RequestWithBook[]> {
    try {
      const userRequests = await db
        .select({
          request: requests,
          username: users.username,
        })
        .from(requests)
        .leftJoin(users, eq(requests.userId, users.id))
        .where(eq(requests.userId, userId))
        .orderBy(desc(requests.requestedAt))

      // Batch fetch all book details
      const bookIds = userRequests.map((r) => r.request.bookId)
      const booksMap = await BookService.getBooksByIds(bookIds)

      // Enrich with book details
      const enrichedRequests = userRequests.map(({ request, username }) => {
        const book = booksMap.get(request.bookId)
        return {
          ...request,
          bookTitle: book?.title || 'Unknown Book',
          bookAuthor: book?.author || 'Unknown Author',
          bookCoverImage: book?.coverImage,
          bookPublishedDate: book?.publishedDate,
          requestedBy: username || 'Unknown User',
        }
      })

      return enrichedRequests
    } catch (error) {
      logger.error('Failed to get user requests', { error: error instanceof Error ? error.message : error, userId })
      throw new Error('Failed to retrieve requests')
    }
  }

  /**
   * Get all requests (admin only)
   */
  static async getAllRequests(): Promise<RequestWithBook[]> {
    try {
      const allRequests = await db
        .select({
          request: requests,
          username: users.username,
        })
        .from(requests)
        .leftJoin(users, eq(requests.userId, users.id))
        .orderBy(desc(requests.requestedAt))

      // Batch fetch all book details
      const bookIds = allRequests.map((r) => r.request.bookId)
      const booksMap = await BookService.getBooksByIds(bookIds)

      // Enrich with book details
      const enrichedRequests = allRequests.map(({ request, username }) => {
        const book = booksMap.get(request.bookId)
        return {
          ...request,
          bookTitle: book?.title || 'Unknown Book',
          bookAuthor: book?.author || 'Unknown Author',
          bookCoverImage: book?.coverImage,
          bookPublishedDate: book?.publishedDate,
          requestedBy: username || 'Unknown User',
        }
      })

      return enrichedRequests
    } catch (error) {
      logger.error('Failed to get all requests', { error: error instanceof Error ? error.message : error })
      throw new Error('Failed to retrieve requests')
    }
  }

  /**
   * Update request status
   */
  static async updateRequest(
    requestId: number,
    data: {
      status?: 'pending' | 'approved' | 'declined' | 'available' | 'processing' | 'error'
      notes?: string
      processedBy?: number
      bookshelfId?: number
      foreignBookId?: string
    }
  ): Promise<Request> {
    try {
      const updateData: Partial<Request> = {
        ...data,
        processedAt: new Date(),
      }

      const result = await db
        .update(requests)
        .set(updateData)
        .where(eq(requests.id, requestId))
        .returning()

      if (result.length === 0) {
        throw new Error('Request not found')
      }

      logger.info('Request updated', {
        requestId,
        status: data.status,
        processedBy: data.processedBy,
      })

      return result[0]
    } catch (error) {
      logger.error('Failed to update request', { error: error instanceof Error ? error.message : error, requestId, data })
      throw error
    }
  }

  /**
   * Delete request
   */
  static async deleteRequest(requestId: number): Promise<void> {
    try {
      await db.delete(requests).where(eq(requests.id, requestId))

      logger.info('Request deleted', { requestId })
    } catch (error) {
      logger.error('Failed to delete request', { error: error instanceof Error ? error.message : error, requestId })
      throw new Error('Failed to delete request')
    }
  }

  /**
   * Get request statistics for a user
   */
  static async getUserRequestStats(userId: number): Promise<{
    pending: number
    approved: number
    available: number
    total: number
  }> {
    try {
      const userRequests = await db
        .select()
        .from(requests)
        .where(eq(requests.userId, userId))

      const stats = {
        pending: userRequests.filter((r) => r.status === 'pending').length,
        approved: userRequests.filter((r) => r.status === 'approved').length,
        available: userRequests.filter((r) => r.status === 'available').length,
        total: userRequests.length,
      }

      return stats
    } catch (error) {
      logger.error('Failed to get request stats', { error: error instanceof Error ? error.message : error, userId })
      throw new Error('Failed to retrieve request statistics')
    }
  }

  /**
   * Check if user has already requested a book
   */
  static async hasUserRequestedBook(
    userId: number,
    bookId: string
  ): Promise<boolean> {
    const result = await db
      .select()
      .from(requests)
      .where(and(eq(requests.userId, userId), eq(requests.bookId, bookId)))
      .limit(1)

    return result.length > 0
  }

  /**
   * Create an Only This Book request
   */
  static async createOnlyThisBookRequest(data: {
    userId: number
    foreignBookId: string
    foreignAuthorId: string
    title: string
    authorName: string
    qualityProfileId: number
    notes?: string
    monitoringOption: 'specificBook'
  }): Promise<Request> {
    try {
      // For Only This Book requests, we need to create a new book entry first
      // In a real implementation, you'd want to integrate with a book database or API
      // Here we'll simulate the process by creating a request that tracks the foreign identifiers
      
      const newRequest: NewRequest = {
        userId: data.userId,
        bookId: data.foreignBookId, // Using foreign ID as bookId for now (this would be a proper book ID in production)
        qualityProfileId: data.qualityProfileId,
        notes: data.notes,
        status: 'pending',
        requestedAt: new Date(),
        foreignBookId: data.foreignBookId,
        foreignAuthorId: data.foreignAuthorId,
        monitoringOption: data.monitoringOption,
      }

      const result = await db.insert(requests).values(newRequest).returning()

      logger.info('Only This Book request created', {
        requestId: result[0].id,
        userId: data.userId,
        foreignBookId: data.foreignBookId,
        title: data.title,
        authorName: data.authorName,
      })

      return result[0]
    } catch (error) {
      logger.error('Failed to create Only This Book request', { error: error instanceof Error ? error.message : error, data })
      throw error
    }
  }

  /**
   * Sync Readarr library to local mirror table
   */
  static async syncReadarrLibrary(bookshelfConfig: { url: string; apiKey: string }): Promise<void> {
    try {
      logger.debug('Starting Readarr library sync')
      
      // Make GET request to Readarr's book endpoint
      const baseUrl = bookshelfConfig.url.replace(/\/$/, '')
      const abortController = new AbortController()
      const timeoutId = setTimeout(() => abortController.abort(), 8000)

      const response = await fetch(`${baseUrl}/api/v1/book`, {
        headers: {
          'X-Api-Key': bookshelfConfig.apiKey,
        },
        signal: abortController.signal
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Failed to fetch Readarr library: ${response.status} ${response.statusText}`)
      }

      const books = await response.json()
      
      // Map the response to extract foreignBookId and determine status
      const mappedData = books.map((book: any) => {
        const foreignBookId = book.foreignBookId || book.id?.toString()
        // Determine status based on monitored and whether book has files
        const hasFiles = book.statistics?.bookFileCount > 0 || book.hasFile === true
        const status = book.monitored && hasFiles ? 'available' : 'monitored'
        
        return {
          foreignBookId,
          status,
          bookshelfId: book.id,
          title: book.title,
          authorName: book.author?.authorName || book.author || '',
        }
      })

      // Perform bulk upsert
      if (mappedData.length > 0) {
        try {
          await db.insert(libraryBooks)
            .values(mappedData)
            .onConflictDoUpdate({
              target: libraryBooks.foreignBookId,
              set: {
                status: sql`excluded.status`,
                bookshelfId: sql`excluded.bookshelf_id`,
                title: sql`excluded.title`,
                authorName: sql`excluded.author_name`
              }
            })
        } catch (dbError: any) {
          logger.error('Database constraint error during library sync', { error: dbError });
          // If we hit a constraint error during bulk insert, try one-by-one to isolate failures
          let successCount = 0;
          for (const item of mappedData) {
             try {
                await db.insert(libraryBooks).values([item]).onConflictDoUpdate({
                   target: libraryBooks.foreignBookId,
                   set: {
                     status: sql`excluded.status`,
                     bookshelfId: sql`excluded.bookshelf_id`,
                     title: sql`excluded.title`,
                     authorName: sql`excluded.author_name`
                   }
                });
                successCount++;
             } catch (singleError: any) {
                logger.error('Failed to sync individual library book', {
                   foreignBookId: item.foreignBookId,
                   error: singleError.message
                });
             }
          }
          logger.warn(`Recovered ${successCount}/${mappedData.length} records via fallback sync`);
        }
      }

      logger.debug('Readarr library sync completed', {
        totalBooks: books.length,
        synced: mappedData.length,
      })
    } catch (error) {
      logger.error('Failed to sync Readarr library', { error: error instanceof Error ? error.message : error })
      // Don't throw - this is a background sync that shouldn't fail the main operation
    }
  }

  /**
   * Target Poll Active Requests (Sniper Polling)
   * Lightweight poll that strictly checks explicitly known bookshelfIds
   * acting as a safety net for missed webhooks.
   */
  static async targetPollActiveRequests(): Promise<{
    checked: number
    updated: number
    errors: number
    details: Array<{
      requestId: number
      bookTitle: string
      oldStatus: string
      newStatus: string
    }>
  }> {
    try {
      logger.trace('Target Polling execution started')

      // Get Bookshelf config from database
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

      if (!bookshelfUrl || !bookshelfApiKey) {
        logger.warn('Bookshelf not configured, skipping poll')
        return { checked: 0, updated: 0, errors: 0, details: [] }
      }

      const bookshelfConfig = {
        url: bookshelfUrl,
        apiKey: bookshelfApiKey,
      }

      // Get active requests (pending, processing, approved, downloading, error)
      const requestsToPoll = await db
        .select()
        .from(requests)
        .where(
          sql`${requests.status} IN ('pending', 'processing', 'approved', 'downloading', 'error')`
        )

      logger.debug('Found requests to poll', {
        total: requestsToPoll.length,
      })

      if (requestsToPoll.length === 0) {
        return { checked: 0, updated: 0, errors: 0, details: [] }
      }

      let checked = 0
      let updated = 0
      let errors = 0
      const details: Array<{
        requestId: number
        bookTitle: string
        oldStatus: string
        newStatus: string
      }> = []

      // Pre-fetch all books in bulk to prevent N+1 queries and rate limiting
      const bookIdsToFetch = Array.from(new Set(requestsToPoll.map(r => r.bookId)))
      let preFetchedBooks = new Map<string, any>()
      try {
        preFetchedBooks = await BookService.getBooksByIds(bookIdsToFetch)
      } catch (prefetchError) {
        logger.error('Failed to pre-fetch books for polling', { error: prefetchError })
      }

      // Poll each request
      for (const request of requestsToPoll) {
        checked++

        // Phase One: Stranded 'Pending' Reconciliation
        if (
          request.status === 'pending' &&
          request.notes &&
          request.notes.includes('MIMIRR_MANUAL_INTERVENTION_REQUIRED')
        ) {
          try {
            await db
              .update(requests)
              .set({ status: 'error' })
              .where(eq(requests.id, request.id))

            logger.info(`Self-healing stranded request ${request.id} from pending to error state.`)
          } catch (error: any) {
            logger.error('Failed to self-heal stranded request', { error: error instanceof Error ? error.message : error, requestId: request.id })
          }
          continue;
        }

        try {
          // Get book details to find foreignBookId
          let book = preFetchedBooks.get(request.bookId)

          if (!book) {
            logger.warn('Book missing from pre-fetch map or fetch failed, skipping request', {
              requestId: request.id,
              bookId: request.bookId,
            });
            errors++;
            continue;
          }

          // Automatic "Unknown Book" Recovery
          if (book && (book.title === 'Unknown Book' || !book.title) && request.foreignBookId) {
             logger.warn(`Unknown Book artifact detected during polling for request ${request.id}. Triggering automatic recovery for foreignBookId: ${request.foreignBookId}`);
             try {
                // Delete stale cache entry to force fresh fetch
                await db.delete(bookCache).where(eq(bookCache.id, request.foreignBookId));

                // Re-fetch book without relying on cache
                const freshBook = await BookService.getBookById(request.bookId);
                if (freshBook && freshBook.title !== 'Unknown Book') {
                   book = freshBook;
                   logger.info(`Successfully recovered Unknown Book artifact`, { newTitle: book.title });
                }
             } catch (recoveryError) {
                logger.error('Failed to recover Unknown Book artifact', { error: recoveryError, requestId: request.id });
             }
          }

          if (!book) {
            logger.error('Book not found for request (after recovery attempt)', {
              requestId: request.id,
              bookId: request.bookId,
            })
            errors++
            continue
          }

          // Self-healing fallback: If bookshelfId is missing, attempt to find it via the full library
          let currentBookshelfId = request.bookshelfId
          const searchForeignId = request.foreignBookId || request.bookId;

          if (!currentBookshelfId && searchForeignId) {
             try {
                const allBooks = await BookshelfService.getLibraryBooks(bookshelfConfig)
                const matchedBook = allBooks.find((b: any) => String(b.foreignBookId) === String(searchForeignId))
                if (matchedBook && matchedBook.id) {
                    currentBookshelfId = matchedBook.id
                    request.bookshelfId = currentBookshelfId // Sync in-memory object
                    logger.info(`Self-healed missing bookshelfId for request ${request.id}`, { newBookshelfId: currentBookshelfId })

                    // Phase Two: Passive Lookup Success Cleanup
                    // Clear the notes field and update the database with the new bookshelfId
                    await db.update(requests).set({
                      bookshelfId: currentBookshelfId,
                      notes: null
                    }).where(eq(requests.id, request.id))
                } else {
                   // Fallback to fuzzy matching by title and author
                   // Ensure safe extraction of author name since book.author may be an object or a string
                   let authorName = '';
                   if (typeof book.author === 'string') {
                       authorName = book.author;
                   } else if (book.author && typeof book.author === 'object') {
                       authorName = (book.author as any).name || (book.author as any).authorName || '';
                   }

                   const fuzzyMatch = await BookshelfService.checkBookInLibrary(bookshelfConfig, searchForeignId, book.title, authorName);

                   if (fuzzyMatch.exists && fuzzyMatch.bookshelfId) {
                      currentBookshelfId = fuzzyMatch.bookshelfId;
                      request.bookshelfId = currentBookshelfId; // Sync in-memory object
                      logger.info(`Self-healed missing bookshelfId for request ${request.id} via fuzzy match`, { newBookshelfId: currentBookshelfId });

                      // Phase Two: Passive Lookup Success Cleanup
                      // Clear the notes field and update the database with the new bookshelfId
                      await db.update(requests).set({
                         bookshelfId: currentBookshelfId,
                         notes: null
                      }).where(eq(requests.id, request.id));
                   }
                }
             } catch (e) {
                logger.error('Failed to self-heal missing bookshelfId', e)
             }
          }

          if (!currentBookshelfId) {
             logger.debug(`Skipping poll for request ${request.id} - no bookshelfId and self-heal failed`)

             if (request.status === 'processing') {
                 // Implement 10-minute grace period before throwing a terminal self-heal error
                 // Fallback: processedAt -> requestedAt
                 const referenceTime = request.processedAt ? new Date(request.processedAt) : new Date(request.requestedAt)
                 const currentTime = new Date()
                 const diffInMinutes = (currentTime.getTime() - referenceTime.getTime()) / (1000 * 60)

                 if (diffInMinutes < 10) {
                     logger.debug(`Request ${request.id} still in grace period (${diffInMinutes.toFixed(1)} mins), skipping terminal failure check`)
                     continue
                 }

                 await db.update(requests).set({
                     status: 'error',
                     notes: 'MIMIRR_SYNC_FAILED: Book missing from Readarr (Self-heal failed)'
                 }).where(eq(requests.id, request.id))

                 logger.info(`Request ${request.id} transitioned to error: Self-heal failed after grace period`)
             }

             continue
          }

          // Check status in Bookshelf
          // Use foreignBookId if available, otherwise fallback to bookId
          const statusResult = await BookshelfService.getAuthorBookStatus(
            bookshelfConfig,
            currentBookshelfId,
            request.foreignBookId || request.bookId,
            book.title
          )

          logger.debug('Poll result', {
            requestId: request.id,
            bookTitle: book.title,
            status: statusResult.status,
            bookFileCount: statusResult.bookFileCount,
          })

          // Update request based on status
          const updateData: Partial<Request> = {
            lastPolledAt: new Date(),
          }

          // Apply self-healed ID if changed
          if (statusResult.bookshelfId && String(statusResult.bookshelfId) !== String(request.bookshelfId)) {
            updateData.bookshelfId = statusResult.bookshelfId
            logger.info('Updated bookshelfId via self-healing', {
              requestId: request.id,
              oldId: request.bookshelfId,
              newId: statusResult.bookshelfId,
            })
          }

          // Update publishedDate in cache if Readarr has a newer one or different date
          if (statusResult.releaseDate) {
            const readarrDate = new Date(statusResult.releaseDate)
            const mimirrDate = book.publishedDate ? new Date(book.publishedDate) : new Date(0)

            // Only update if the specific YYYY-MM-DD day is actually different or newer
            const normalizedReadarrDate = RequestService.formatToYYYYMMDD(statusResult.releaseDate)
            const normalizedMimirrDate = book.publishedDate ? RequestService.formatToYYYYMMDD(book.publishedDate) : null

            if (readarrDate > mimirrDate && normalizedReadarrDate !== normalizedMimirrDate) {
              await db
                .update(bookCache)
                .set({ publishedDate: statusResult.releaseDate })
                .where(eq(bookCache.id, book.id))

              logger.info('Updated book release date from Readarr', {
                bookId: book.id,
                oldDate: book.publishedDate,
                newDate: statusResult.releaseDate,
                normalizedOld: normalizedMimirrDate,
                normalizedNew: normalizedReadarrDate
              })

              book.publishedDate = statusResult.releaseDate
            }
          }

          if (statusResult.status === 'available' && request.status !== 'available') {
            logger.debug('State Machine Transition: Request Available', { requestId: request.id, previousState: request.status, newState: 'available' })
            updateData.status = 'available'
            updateData.completedAt = new Date()
            updateData.notes = null // Clear any SEARCHING or ERROR notes when book becomes available
            updated++

            details.push({
              requestId: request.id,
              bookTitle: book.title,
              oldStatus: request.status,
              newStatus: 'available',
            })

            logger.info('Request completed', {
              requestId: request.id,
              bookTitle: book.title,
              bookFileCount: statusResult.bookFileCount,
            })

            // Get requesting user's details for notification
            const requestingUser = await db
              .select()
              .from(users)
              .where(eq(users.id, request.userId))
              .limit(1)

            const username = requestingUser[0]?.username || 'Unknown User'

            // Get quality profile name from Bookshelf
            let qualityProfileName = 'Unknown'
            try {
              if (bookshelfUrl && bookshelfApiKey) {
                const profiles = await BookshelfService.getQualityProfiles({
                  url: bookshelfUrl,
                  apiKey: bookshelfApiKey,
                })
                const profile = profiles.find((p) => p.id === request.qualityProfileId)
                if (profile) qualityProfileName = profile.name
              }
            } catch (error) {
              logger.error('Failed to fetch quality profile', { error: error instanceof Error ? error.message : error })
            }

            // Send notification to user
            await NotificationService.sendNotification(
              request.userId,
              'request_available',
              'Book Available',
              book.title,
              book.author || 'Unknown Author',
              book.description || 'No description available',
              book.coverImage,
              username,
              'Available',
              qualityProfileName,
              '/requests'
            )
          } else if (statusResult.status === 'downloading') {
            // Advance unreleased (approved) books to processing
            if (request.status === 'approved') {
              logger.debug('State Machine Transition: Request Processing', { requestId: request.id, previousState: request.status, newState: 'processing' })
              updateData.status = 'processing'
              updated++

              details.push({
                requestId: request.id,
                bookTitle: book.title,
                oldStatus: 'approved',
                newStatus: 'processing',
              })

              logger.info('Request advanced to processing', {
                requestId: request.id,
                bookTitle: book.title,
              })
            }
          } else if (statusResult.status === 'missing') {
            // Apply Unreleased vs Processing tie-breaker
            if (book.publishedDate) {
              const releaseDate = new Date(book.publishedDate)
              const currentDate = new Date()
              const bufferHours = 24
              const bufferedReleaseDate = new Date(releaseDate.getTime() + bufferHours * 60 * 60 * 1000)

              if (currentDate < bufferedReleaseDate) {
                if (request.status !== 'approved') {
                  logger.debug('State Machine Transition: Request Approved (Unreleased)', { requestId: request.id, previousState: request.status, newState: 'approved' })
                  updateData.status = 'approved' // Mimirr's Unreleased state
                  updated++
                  details.push({
                    requestId: request.id,
                    bookTitle: book.title,
                    oldStatus: request.status,
                    newStatus: 'approved',
                  })
                  logger.info('Request mapped back to Unreleased state', {
                    requestId: request.id,
                    bookTitle: book.title,
                  })
                }
              } else {
                if (request.status !== 'processing') {
                  logger.debug('State Machine Transition: Request Processing (Past Release Date)', { requestId: request.id, previousState: request.status, newState: 'processing' })
                  updateData.status = 'processing'
                  updated++
                  details.push({
                    requestId: request.id,
                    bookTitle: book.title,
                    oldStatus: request.status,
                    newStatus: 'processing',
                  })
                  logger.info('Request advanced to processing (past release date)', {
                    requestId: request.id,
                    bookTitle: book.title,
                  })
                }

                // Trigger a search in Readarr for missing/released books and update notes
                const SEARCHING_NOTE = 'MIMIRR_SEARCHING: Book is released; Mimirr has triggered a search in Readarr.';
                if (currentBookshelfId && request.notes !== SEARCHING_NOTE && updateData.notes !== SEARCHING_NOTE) {
                  updateData.notes = SEARCHING_NOTE
                  logger.info('Triggering search for missing/released book', {
                    requestId: request.id,
                    bookTitle: book.title,
                  })
                  await BookshelfService.triggerBookSearch(bookshelfConfig, [currentBookshelfId]).catch((err) => {
                    logger.error('Failed to trigger background search', { error: err })
                  })
                }
              }
            }
          } else if (statusResult.status === 'error') {
            // Check if there is an explicit error message needing manual intervention
            if (statusResult.error && statusResult.error.includes('MIMIRR_MANUAL_INTERVENTION_REQUIRED')) {
               if (request.status !== 'error') {
                 logger.debug('State Machine Transition: Request Error (Manual Intervention)', { requestId: request.id, previousState: request.status, newState: 'error', reason: statusResult.error })
                 updateData.status = 'error'
                 updateData.notes = statusResult.error
                 updated++
                 details.push({
                   requestId: request.id,
                   bookTitle: book.title,
                   oldStatus: request.status,
                   newStatus: 'error',
                 })
                 
                 // Notify Admins
                 const adminIds = await NotificationService.getAdminUserIds()
                 await NotificationService.sendNotification(
                   adminIds,
                   'request_error',
                   'Bookshelf Sync Error',
                   book.title,
                   book.author || 'Unknown Author',
                   `Manual Intervention Required: ${statusResult.error}`,
                   book.coverImage,
                   'System',
                   'Error',
                   'N/A',
                   '/requests/all?filter=error'
                 )
                 
               }
            } else if (statusResult.error && statusResult.error.includes('Book not found in Bookshelf')) {
              // Terminal error: Book is completely missing from Readarr after all fallback checks
              if (request.status !== 'error') {
                logger.debug('State Machine Transition: Request Error (Terminal Missing)', { requestId: request.id, previousState: request.status, newState: 'error', reason: 'Book missing from Readarr' })
                updateData.status = 'error'
                updateData.notes = 'MIMIRR_SYNC_FAILED: Book missing from Readarr'
                updated++
                details.push({
                  requestId: request.id,
                  bookTitle: book.title,
                  oldStatus: request.status,
                  newStatus: 'error',
                })

                logger.info('Request transitioned to error: Book missing from Readarr', {
                  requestId: request.id,
                  bookTitle: book.title,
                })
              }
            } else {
              // Log error but keep as processing/approved - could be temporary
              logger.warn('Error checking request status', {
                requestId: request.id,
                error: statusResult.error,
              })
              errors++
            }
          }

          // Update request regardless of status (updates lastPolledAt)
          try {
            await db
              .update(requests)
              .set(updateData)
              .where(eq(requests.id, request.id))
          } catch (dbError: any) {
             logger.error('Database constraint error updating request status', {
               error: dbError,
               requestId: request.id,
               updateData
             });
             errors++;
          }
        } catch (error: any) {
          // Detect Readarr HTTP 409 Conflict errors (often related to Editions/Constraint failures on their end)
          if (error.message && error.message.includes('409')) {
             logger.error('Readarr 409 Conflict Error during polling (Editions/Constraint Sync Failure)', {
                requestId: request.id,
                foreignBookId: request.foreignBookId,
                error: error.message
             });

             // Trigger a Self-Healing Sync: nullify the Readarr ID to force a fresh lookup next cycle
             try {
                logger.warn(`Self-Healing Sync Triggered: Disconnecting Readarr ID for Request ${request.id}`);
                await db.update(requests).set({ bookshelfId: null }).where(eq(requests.id, request.id));
             } catch (healError) {
                logger.error('Failed to apply Self-Healing Sync', healError);
             }
          } else if (error.name === 'AbortError' || error.message?.includes('operation was aborted')) {
             logger.warn('Polling operation aborted for request, continuing to next', {
               requestId: request.id,
               error: error.message
             });
          } else {
             logger.error('Failed to poll request', {
               error,
               requestId: request.id,
             })
          }
          errors++
          continue
        }
      }

      logger.info('Sniper polling completed', {
        checked,
        updated,
        errors,
      })
      logger.trace('Target Polling execution details', { details })

      return { checked, updated, errors, details }
    } catch (error) {
      logger.error('Failed to execute sniper polling', { error: error instanceof Error ? error.message : error })
      throw error
    }
  }
}

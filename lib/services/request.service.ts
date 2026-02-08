import { db, requests, users, settings, type Request, type NewRequest } from '@/lib/db'
import { eq, and, desc, isNotNull, lt, sql } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'
import { BookService } from './book.service'
import { BookshelfService } from './bookshelf.service'
import { NotificationService } from './notification.service'

export interface RequestWithBook extends Request {
  bookTitle: string
  bookAuthor: string
  bookCoverImage?: string
}

export class RequestService {
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
      logger.error('Failed to create request', { error, data })
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
        .select()
        .from(requests)
        .where(eq(requests.userId, userId))
        .orderBy(desc(requests.requestedAt))

      // Batch fetch all book details
      const bookIds = userRequests.map(r => r.bookId)
      const booksMap = await BookService.getBooksByIds(bookIds)

      // Enrich with book details
      const enrichedRequests = userRequests.map((request) => {
        const book = booksMap.get(request.bookId)
        return {
          ...request,
          bookTitle: book?.title || 'Unknown Book',
          bookAuthor: book?.author || 'Unknown Author',
          bookCoverImage: book?.coverImage,
        }
      })

      return enrichedRequests
    } catch (error) {
      logger.error('Failed to get user requests', { error, userId })
      throw new Error('Failed to retrieve requests')
    }
  }

  /**
   * Get all requests (admin only)
   */
  static async getAllRequests(): Promise<RequestWithBook[]> {
    try {
      const allRequests = await db
        .select()
        .from(requests)
        .orderBy(desc(requests.requestedAt))

      // Batch fetch all book details
      const bookIds = allRequests.map(r => r.bookId)
      const booksMap = await BookService.getBooksByIds(bookIds)

      // Enrich with book details
      const enrichedRequests = allRequests.map((request) => {
        const book = booksMap.get(request.bookId)
        return {
          ...request,
          bookTitle: book?.title || 'Unknown Book',
          bookAuthor: book?.author || 'Unknown Author',
          bookCoverImage: book?.coverImage,
        }
      })

      return enrichedRequests
    } catch (error) {
      logger.error('Failed to get all requests', { error })
      throw new Error('Failed to retrieve requests')
    }
  }

  /**
   * Update request status
   */
  static async updateRequest(
    requestId: number,
    data: {
      status?: 'pending' | 'approved' | 'declined' | 'available' | 'processing'
      notes?: string
      processedBy?: number
      bookshelfId?: number
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
      logger.error('Failed to update request', { error, requestId, data })
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
      logger.error('Failed to delete request', { error, requestId })
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
      logger.error('Failed to get request stats', { error, userId })
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
      logger.error('Failed to create Only This Book request', { error, data })
      throw error
    }
  }

  /**
   * Poll Bookshelf for status of all "processing" requests
   * Updates request status to "available" when downloaded
   * Updates lastPolledAt timestamp
   */
  static async pollProcessingRequests(): Promise<{
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
      logger.info('Starting polling of processing requests')

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

      // Get all processing requests with bookshelfId
      const processingRequests = await db
        .select()
        .from(requests)
        .where(
          and(
            eq(requests.status, 'processing'),
            isNotNull(requests.bookshelfId)
          )
        )

      // For now, poll all processing requests (no rate limiting)
      // TODO: Re-enable rate limiting after testing
      const requestsToPoll = processingRequests

      logger.info('Found requests to poll', {
        total: processingRequests.length,
        toPoll: requestsToPoll.length,
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

      // Poll each request
      for (const request of requestsToPoll) {
        checked++

        try {
          // Get book details to find foreignBookId
          const book = await BookService.getBookById(request.bookId)
          if (!book) {
            logger.error('Book not found for request', {
              requestId: request.id,
              bookId: request.bookId,
            })
            errors++
            continue
          }

          // Check status in Bookshelf
          const statusResult = await BookshelfService.getAuthorBookStatus(
            bookshelfConfig,
            request.bookshelfId!,
            request.bookId // foreignBookId is the same as bookId in our system
          )

          logger.debug('Poll result', {
            requestId: request.id,
            bookTitle: book.title,
            status: statusResult.status,
            bookFileCount: statusResult.bookFileCount,
          })

          // Update request based on status
          let newStatus: 'processing' | 'available' = 'processing'
          const updateData: Partial<Request> = {
            lastPolledAt: new Date(),
          }

          if (statusResult.status === 'available') {
            newStatus = 'available'
            updateData.status = 'available'
            updateData.completedAt = new Date()
            updated++

            details.push({
              requestId: request.id,
              bookTitle: book.title,
              oldStatus: 'processing',
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
              logger.error('Failed to fetch quality profile', { error })
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
          } else if (statusResult.status === 'error') {
            // Log error but keep as processing - could be temporary
            logger.warn('Error checking request status', {
              requestId: request.id,
              error: statusResult.error,
            })
            errors++
          }

          // Update lastPolledAt regardless of status
          await db
            .update(requests)
            .set(updateData)
            .where(eq(requests.id, request.id))
        } catch (error) {
          logger.error('Failed to poll request', {
            error,
            requestId: request.id,
          })
          errors++
        }
      }

      logger.info('Polling completed', {
        checked,
        updated,
        errors,
      })

      return { checked, updated, errors, details }
    } catch (error) {
      logger.error('Failed to poll processing requests', { error })
      throw error
    }
  }
}

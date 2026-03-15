import { NextRequest, NextResponse } from 'next/server'
import { withLogging } from '@/lib/middleware/logging.middleware'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import { db, bookCache, requests } from '@/lib/db'
import { eq, or } from 'drizzle-orm'
import { BookinfoService } from '@/lib/services/bookinfo.service'
import { BookService } from '@/lib/services/book.service'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/scrub
 * Scrubs the local book cache for a specific foreignBookId and forces a metadata refresh.
 */
async function postHandler(request: NextRequest) {
  try {
    const user = await requireAdmin(request)
    const body = await request.json()
    const { foreignBookId } = body

    if (!foreignBookId) {
      return NextResponse.json(
        { error: 'foreignBookId is required' },
        { status: 400 }
      )
    }

    logger.warn('Admin Scrub Tool Invoked', { adminId: user.userId, foreignBookId })

    // 1. Delete the book from the local cache
    await db.delete(bookCache).where(eq(bookCache.id, foreignBookId))
    logger.info('Scrub Tool: Deleted from book_cache', { foreignBookId })

    // 2. Force a metadata refresh from BookinfoService (Hardcover)
    try {
      // Use AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      try {
        const freshBook = await BookinfoService.getBookById(foreignBookId, controller.signal)

        if (freshBook) {
          // Cache the freshly fetched book
          await BookService.cacheBook(freshBook)
          logger.info('Scrub Tool: Fresh metadata cached', { foreignBookId, title: freshBook.title })

          return NextResponse.json({
            message: 'Scrub successful. Book metadata refreshed.',
            book: {
              id: freshBook.id,
              title: freshBook.title,
              author: freshBook.author
            }
          })
        } else {
          logger.warn('Scrub Tool: Book not found upstream after cache deletion', { foreignBookId })
          return NextResponse.json(
            { error: 'Book deleted from cache, but failed to fetch fresh metadata from upstream.' },
            { status: 404 }
          )
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (fetchError: any) {
      logger.error('Scrub Tool: Failed to fetch fresh metadata', { foreignBookId, error: fetchError.message })
      return NextResponse.json(
        { error: `Cache cleared, but failed to refresh metadata: ${fetchError.message}` },
        { status: 500 }
      )
    }

  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Scrub Tool execution error', { error })
    return NextResponse.json(
      { error: 'An unexpected error occurred during the scrub process' },
      { status: 500 }
    )
  }
}

export const POST = withLogging(postHandler)

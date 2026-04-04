import { NextRequest, NextResponse } from 'next/server'
import { withLogging } from '@/lib/middleware/logging.middleware'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { BookService } from '@/lib/services/book.service'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

async function getHandler(request: NextRequest) {
  try {
    // Require authentication
    await requireAuth(request)

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    const books = await BookService.getPopularBooks(limit)

    return NextResponse.json({ books })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Get popular books API error', { error: error instanceof Error ? error.message : error })
    return NextResponse.json(
      { error: 'Failed to retrieve popular books' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler)

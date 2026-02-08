import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError, handleAuthError } from '@/lib/middleware/auth.middleware'
import * as RecommendationService from '@/lib/services/recommendation.service'
import { BookService } from '@/lib/services/book.service'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/discover/personalized - Get personalized book recommendations
 * Returns three sections: Popular Books for You, New Books for You, Authors You Might Enjoy
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await requireAuth(request)

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Check if user has preferences (which means they have requests)
    const prefs = await RecommendationService.getUserPreferences(payload.userId)

    if (!prefs || prefs.totalRequests === 0) {
      // User has no requests yet
      return NextResponse.json({
        hasRequests: false,
        popularForYou: [],
        newForYou: [],
        authorsForYou: [],
      })
    }

    // Use cached recommendations if available
    let popularForYou: any[] = []
    let newForYou: any[] = []
    let authorsForYou: any[] = []

    if (prefs.recommendedPopularBooks) {
      const bookIds = JSON.parse(prefs.recommendedPopularBooks) as string[]
      const booksMap = await BookService.getBooksByIds(bookIds.slice(0, limit))
      popularForYou = bookIds.slice(0, limit).map(id => booksMap.get(id)).filter(Boolean)
    }

    if (prefs.recommendedNewBooks) {
      const bookIds = JSON.parse(prefs.recommendedNewBooks) as string[]
      const booksMap = await BookService.getBooksByIds(bookIds.slice(0, limit))
      newForYou = bookIds.slice(0, limit).map(id => booksMap.get(id)).filter(Boolean)
    }

    if (prefs.recommendedAuthorBooks) {
      // Authors are stored as JSON array of Author objects
      try {
        authorsForYou = JSON.parse(prefs.recommendedAuthorBooks)
      } catch (error) {
        logger.error('Failed to parse recommended authors', { error, userId: payload.userId })
        authorsForYou = []
      }
    }

    logger.info('Personalized recommendations generated', {
      userId: payload.userId,
      popularCount: popularForYou.length,
      newCount: newForYou.length,
      authorsCount: authorsForYou.length,
      hasRequests: true,
    })

    const response = {
      hasRequests: true,
      popularForYou,
      newForYou,
      authorsForYou,
    }

    logger.debug('Personalized API response', { response: JSON.stringify(response).substring(0, 200) })

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error)
    }

    logger.error('Failed to get personalized recommendations', { error })
    return NextResponse.json(
      { error: 'Failed to get personalized recommendations' },
      { status: 500 }
    )
  }
}

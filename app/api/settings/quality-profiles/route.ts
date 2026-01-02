import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { BookshelfService } from '@/lib/services/bookshelf.service'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/settings/quality-profiles - Get enabled quality profiles in order
 * This endpoint returns only enabled profiles sorted by order for use in request forms
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    await requireAuth(request)

    // Fetch enabled quality profiles in order from database
    const profiles = await BookshelfService.getEnabledQualityProfiles()

    return NextResponse.json({ profiles })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Get quality profiles API error', { error })
    return NextResponse.json(
      { error: 'Failed to fetch quality profiles' },
      { status: 500 }
    )
  }
}

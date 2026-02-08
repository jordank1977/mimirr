import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import { BookshelfService } from '@/lib/services/bookshelf.service'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/settings/bookshelf/quality-profiles - Get quality profile configurations
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const configs = await BookshelfService.getQualityProfileConfigs()

    return NextResponse.json({ profiles: configs })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Get quality profile configs error', { error })
    return NextResponse.json(
      { error: 'Failed to retrieve quality profiles' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/settings/bookshelf/quality-profiles - Update quality profile configuration
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = await request.json()

    const { profileId, enabled, orderIndex } = body

    if (!profileId) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      )
    }

    const updates: { enabled?: boolean; orderIndex?: number } = {}
    if (typeof enabled === 'boolean') updates.enabled = enabled
    if (typeof orderIndex === 'number') updates.orderIndex = orderIndex

    await BookshelfService.updateQualityProfileConfig(profileId, updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Update quality profile config error', { error })
    return NextResponse.json(
      { error: 'Failed to update quality profile' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/bookshelf/quality-profiles - Reorder quality profiles
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = await request.json()

    const { orderedProfileIds } = body

    if (!Array.isArray(orderedProfileIds)) {
      return NextResponse.json(
        { error: 'orderedProfileIds must be an array' },
        { status: 400 }
      )
    }

    await BookshelfService.reorderQualityProfiles(orderedProfileIds)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Reorder quality profiles error', { error })
    return NextResponse.json(
      { error: 'Failed to reorder quality profiles' },
      { status: 500 }
    )
  }
}

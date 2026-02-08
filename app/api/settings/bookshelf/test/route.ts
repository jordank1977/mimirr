import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import { bookshelfSettingsSchema } from '@/lib/utils/validation'
import { BookshelfService } from '@/lib/services/bookshelf.service'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/settings/bookshelf/test - Test Bookshelf connection without saving
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = await request.json()

    // Validate input
    const validatedData = bookshelfSettingsSchema.parse(body)

    // Test connection
    const isConnected = await BookshelfService.testConnection({
      url: validatedData.url,
      apiKey: validatedData.apiKey,
    })

    if (!isConnected) {
      return NextResponse.json(
        { error: 'Failed to connect to Bookshelf. Please check your URL and API key.' },
        { status: 400 }
      )
    }

    // Fetch quality profiles to show in preview
    let profiles: any[] = []
    try {
      const qualityProfiles = await BookshelfService.getQualityProfiles({
        url: validatedData.url,
        apiKey: validatedData.apiKey,
      })

      profiles = qualityProfiles.map((profile: any, index: number) => ({
        id: 0, // Temporary ID for preview
        profileId: profile.id,
        profileName: profile.name,
        enabled: true, // Default to enabled for new profiles
        orderIndex: index,
      }))
    } catch (error) {
      logger.error('Failed to fetch quality profiles during test', { error })
      // Don't fail the test if profile fetch fails
    }

    logger.info('Bookshelf connection test successful', {
      url: validatedData.url,
      profileCount: profiles.length
    })

    return NextResponse.json({
      success: true,
      message: 'Connection successful',
      profileCount: profiles.length,
      profiles,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    if (error instanceof Error) {
      logger.error('Test Bookshelf connection error', { error: error.message })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.error('Unexpected test connection error', { error })
    return NextResponse.json(
      { error: 'Connection test failed' },
      { status: 500 }
    )
  }
}

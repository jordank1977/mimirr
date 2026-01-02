import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import { db, settings } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { bookshelfSettingsSchema } from '@/lib/utils/validation'
import { BookshelfService } from '@/lib/services/bookshelf.service'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/settings/bookshelf - Get Bookshelf configuration
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

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

    return NextResponse.json({
      url: urlSetting[0]?.value || '',
      apiKey: apiKeySetting[0]?.value || '',
      configured: urlSetting.length > 0 && apiKeySetting.length > 0,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Get Bookshelf settings error', { error })
    return NextResponse.json(
      { error: 'Failed to retrieve settings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/bookshelf - Update Bookshelf configuration
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request)
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

    const now = new Date()

    // Upsert URL setting
    await db
      .insert(settings)
      .values({
        key: 'bookshelf_url',
        value: validatedData.url,
        category: 'bookshelf',
        updatedAt: now,
        updatedBy: user.userId,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: validatedData.url,
          updatedAt: now,
          updatedBy: user.userId,
        },
      })

    // Upsert API key setting
    await db
      .insert(settings)
      .values({
        key: 'bookshelf_api_key',
        value: validatedData.apiKey,
        category: 'bookshelf',
        updatedAt: now,
        updatedBy: user.userId,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: validatedData.apiKey,
          updatedAt: now,
          updatedBy: user.userId,
        },
      })

    // Sync quality profiles from Bookshelf
    try {
      await BookshelfService.syncQualityProfiles({
        url: validatedData.url,
        apiKey: validatedData.apiKey,
      })
    } catch (syncError) {
      // Log but don't fail the request - profiles can be synced later
      logger.error('Failed to sync quality profiles', { error: syncError })
    }

    logger.info('Bookshelf settings updated', { userId: user.userId })

    return NextResponse.json({
      message: 'Bookshelf configured successfully',
      url: validatedData.url,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    if (error instanceof Error) {
      logger.error('Update Bookshelf settings error', { error: error.message })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.error('Unexpected update settings error', { error })
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

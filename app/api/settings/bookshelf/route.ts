import { NextRequest, NextResponse } from 'next/server'
import { withLogging } from '@/lib/middleware/logging.middleware'
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
async function getHandler(request: NextRequest) {
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

    // Never return the plaintext API key to the client (Rule 4)
    const hasApiKey = Boolean(apiKeySetting[0]?.value)

    return NextResponse.json({
      url: urlSetting[0]?.value || '',
      hasApiKey,
      configured: urlSetting.length > 0 && hasApiKey,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Get Bookshelf settings error', { error: error instanceof Error ? error.message : error })
    return NextResponse.json(
      { error: 'Failed to retrieve settings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/bookshelf - Update Bookshelf configuration
 */
async function postHandler(request: NextRequest) {
  try {
    const user = await requireAdmin(request)
    const body = await request.json()

    // Validate input
    const validatedData = bookshelfSettingsSchema.parse(body)
    const newApiKey = validatedData.apiKey?.trim() || ''

    let effectiveApiKey = newApiKey

    // If API key is omitted, fall back to the stored key
    if (!effectiveApiKey) {
      const apiKeySetting = await db
        .select()
        .from(settings)
        .where(eq(settings.key, 'bookshelf_api_key'))
        .limit(1)

      effectiveApiKey = apiKeySetting[0]?.value || ''

      if (!effectiveApiKey) {
        return NextResponse.json(
          { error: 'API key is required but no existing API key was found.' },
          { status: 400 }
        )
      }
    }

    // Test connection
    const isConnected = await BookshelfService.testConnection({
      url: validatedData.url,
      apiKey: effectiveApiKey,
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

    // Upsert API key setting - only if a new API key was provided
    if (newApiKey) {
      await db
        .insert(settings)
        .values({
          key: 'bookshelf_api_key',
          value: newApiKey,
          category: 'bookshelf',
          updatedAt: now,
          updatedBy: user.userId,
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: newApiKey,
            updatedAt: now,
            updatedBy: user.userId,
          },
        })
    }

    // Sync quality profiles from Bookshelf
    try {
      await BookshelfService.syncQualityProfiles({
        url: validatedData.url,
        apiKey: effectiveApiKey,
      })
    } catch (syncError) {
      // Log but don't fail the request - profiles can be synced later
      logger.error('Failed to sync quality profiles', { error: syncError })
    }

    logger.info('Bookshelf settings updated. Triggering auto-scan in background.', { userId: user.userId })

    // Auto-Scan on Connect: Fire-and-forget background sync
    import('@/lib/services/sync.service').then(({ SyncService }) => {
      SyncService.runBackgroundSync().catch(err => {
        logger.error('Failed to trigger background auto-scan after configuration update', { error: err })
      })
    })

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

    logger.error('Unexpected update settings error', { error: error instanceof Error ? error.message : error })
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler)
export const POST = withLogging(postHandler)

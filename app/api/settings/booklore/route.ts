import { NextRequest, NextResponse } from 'next/server'
import { withLogging } from '@/lib/middleware/logging.middleware'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import { db, settings } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { bookloreSettingsSchema } from '@/lib/utils/validation'
import { BookLoreService } from '@/lib/services/booklore.service'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/settings/booklore - Get BookLore configuration
 */
async function getHandler(request: NextRequest) {
  try {
    await requireAdmin(request)

    const urlSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'booklore_url'))
      .limit(1)

    const usernameSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'booklore_username'))
      .limit(1)

    const passwordSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'booklore_password'))
      .limit(1)

    const libraryIdSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'booklore_library_id'))
      .limit(1)

    // Mask password for security - return "********" if password exists
    const passwordValue = passwordSetting[0]?.value || ''
    const maskedPassword = passwordValue ? '********' : ''

    return NextResponse.json({
      url: urlSetting[0]?.value || '',
      username: usernameSetting[0]?.value || '',
      password: maskedPassword,
      libraryId: libraryIdSetting[0]?.value || '',
      configured: urlSetting.length > 0 && usernameSetting.length > 0 && passwordSetting.length > 0 && libraryIdSetting.length > 0,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Get BookLore settings error', { error: error instanceof Error ? error.message : error })
    return NextResponse.json(
      { error: 'Failed to retrieve settings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/booklore - Update BookLore configuration
 */
async function postHandler(request: NextRequest) {
  try {
    const user = await requireAdmin(request)
    const body = await request.json()

    // Validate input
    const validatedData = bookloreSettingsSchema.parse(body)

    // Test connection
    const isConnected = await BookLoreService.testConnection({
      url: validatedData.url,
      username: validatedData.username,
      password: validatedData.password,
      libraryId: validatedData.libraryId,
    })

    if (!isConnected) {
      return NextResponse.json(
        { error: 'Failed to connect to BookLore. Please check your URL, credentials, and library ID.' },
        { status: 400 }
      )
    }

    const now = new Date()

    // Upsert URL setting
    await db
      .insert(settings)
      .values({
        key: 'booklore_url',
        value: validatedData.url,
        category: 'booklore',
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

    // Upsert username setting
    await db
      .insert(settings)
      .values({
        key: 'booklore_username',
        value: validatedData.username,
        category: 'booklore',
        updatedAt: now,
        updatedBy: user.userId,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: validatedData.username,
          updatedAt: now,
          updatedBy: user.userId,
        },
      })

    // Upsert password setting - skip if password is "********" (masked placeholder)
    if (validatedData.password !== '********') {
      await db
        .insert(settings)
        .values({
          key: 'booklore_password',
          value: validatedData.password,
          category: 'booklore',
          updatedAt: now,
          updatedBy: user.userId,
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: validatedData.password,
            updatedAt: now,
            updatedBy: user.userId,
          },
        })
    }

    // Upsert library ID setting
    await db
      .insert(settings)
      .values({
        key: 'booklore_library_id',
        value: validatedData.libraryId,
        category: 'booklore',
        updatedAt: now,
        updatedBy: user.userId,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: validatedData.libraryId,
          updatedAt: now,
          updatedBy: user.userId,
        },
      })

    logger.info('BookLore settings updated', { userId: user.userId })

    return NextResponse.json({
      message: 'BookLore configured successfully',
      url: validatedData.url,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    if (error instanceof Error) {
      logger.error('Update BookLore settings error', { error: error.message })
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
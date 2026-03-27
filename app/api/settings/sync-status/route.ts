import { NextResponse } from 'next/server'
import { db, settings, syncJobs } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { withLogging } from '@/lib/middleware/logging.middleware'

export const dynamic = 'force-dynamic'

async function getHandler(request: Request) {
  try {
    // Require authentication to fetch sync status
    await requireAuth(request as any)

    // Check if Bookshelf is configured
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

    const isBookshelfConfigured = urlSetting.length > 0 && apiKeySetting.length > 0 && !!urlSetting[0].value && !!apiKeySetting[0].value

    // Check if at least one sync job has completed
    const syncCheck = await db
      .select()
      .from(syncJobs)
      .where(eq(syncJobs.status, 'complete'))
      .limit(1)

    const isSyncCompleted = syncCheck.length > 0

    return NextResponse.json({
      isBookshelfConfigured,
      isSyncCompleted,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Failed to get sync status', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler)

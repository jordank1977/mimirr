import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import { db, settings } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const logLevelSchema = z.object({
  level: z.enum(['info', 'warn', 'error', 'debug']),
})

/**
 * GET /api/settings/logs - Get log configuration
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const logLevelSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'log_level'))
      .limit(1)

    return NextResponse.json({
      level: logLevelSetting[0]?.value || 'info',
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Get log settings error', { error })
    return NextResponse.json(
      { error: 'Failed to retrieve log settings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/logs - Update log configuration
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request)
    const body = await request.json()

    // Validate input
    const validatedData = logLevelSchema.parse(body)

    const now = new Date()

    // Upsert log level setting
    await db
      .insert(settings)
      .values({
        key: 'log_level',
        value: validatedData.level,
        category: 'general',
        updatedAt: now,
        updatedBy: user.userId,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: validatedData.level,
          updatedAt: now,
          updatedBy: user.userId,
        },
      })

    logger.info('Log level updated', { level: validatedData.level, userId: user.userId })

    return NextResponse.json({
      message: 'Log configuration updated successfully',
      level: validatedData.level,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid log level' }, { status: 400 })
    }

    logger.error('Update log settings error', { error })
    return NextResponse.json(
      { error: 'Failed to update log settings' },
      { status: 500 }
    )
  }
}

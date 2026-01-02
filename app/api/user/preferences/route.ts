import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError, AuthError } from '@/lib/middleware/auth.middleware'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/user/preferences - Update user preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    const payload = await requireAuth(request)
    const body = await request.json()

    const updateData: Partial<typeof users.$inferSelect> = {
      updatedAt: new Date(),
    }

    // Note: User preferences like hideGettingStarted and hideTutorials have been removed
    // This endpoint is kept for future preference updates

    const result = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, payload.userId))
      .returning()

    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    logger.info('User preferences updated', {
      userId: payload.userId,
      preferences: body,
    })

    const { passwordHash: _, ...userWithoutPassword } = result[0]
    return NextResponse.json({ user: userWithoutPassword })
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error)
    }

    logger.error('Failed to update user preferences', { error })
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth.middleware'
import { db, users } from '@/lib/db'
import { eq, and, or } from 'drizzle-orm'
import { hashPassword, verifyPassword } from '@/lib/utils/crypto'
import { logger } from '@/lib/utils/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateProfileSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).max(100).optional(),
})

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { userId } = authResult
    const body = await request.json()

    // Validate input
    const validationResult = updateProfileSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error },
        { status: 400 }
      )
    }

    const { username, email, currentPassword, newPassword } = validationResult.data

    // Check if username or email is already taken by another user
    const conflictingUsers = await db
      .select()
      .from(users)
      .where(or(eq(users.username, username), eq(users.email, email)))

    // Filter out current user from conflicts
    const conflicts = conflictingUsers.filter(u => u.id !== userId)

    if (conflicts.length > 0) {
      const conflict = conflicts[0]
      if (conflict.username === username) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 409 }
        )
      }
      if (conflict.email === email) {
        return NextResponse.json(
          { error: 'Email is already taken' },
          { status: 409 }
        )
      }
    }

    // Get current user for password verification
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // If changing password, verify current password
    let passwordHash = currentUser.passwordHash
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to set a new password' },
          { status: 400 }
        )
      }

      const isValidPassword = await verifyPassword(currentPassword, currentUser.passwordHash)
      if (!isValidPassword) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 401 }
        )
      }

      passwordHash = await hashPassword(newPassword)
    }

    // Update user
    await db
      .update(users)
      .set({
        username,
        email,
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    logger.info('User profile updated', { userId, username })

    return NextResponse.json({
      message: 'Profile updated successfully',
    })
  } catch (error) {
    logger.error('Failed to update profile', { error })
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}

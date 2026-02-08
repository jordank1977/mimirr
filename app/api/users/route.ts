import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import { UserService } from '@/lib/services/user.service'
import { createUserSchema } from '@/lib/utils/validation'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/users - Get all users (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const users = await UserService.getAllUsers()
    const stats = await UserService.getUserStats()

    return NextResponse.json({ users, stats })
  } catch (error) {
    return handleAuthError(error)
  }
}

/**
 * POST /api/users - Create a new user (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()

    // Validate request body
    const validationResult = createUserSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const user = await UserService.createUser(validationResult.data)

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
      if (error.message.includes('Authentication')) {
        return handleAuthError(error)
      }
    }

    logger.error('Failed to create user', { error })
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

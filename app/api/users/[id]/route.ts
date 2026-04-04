import { NextRequest, NextResponse } from 'next/server'
import { withLogging } from '@/lib/middleware/logging.middleware'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import { UserService } from '@/lib/services/user.service'
import { updateUserSchema } from '@/lib/utils/validation'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/users/[id] - Get single user (admin only)
 */
async function getHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)
    const { id } = await params
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const user = await UserService.getUserById(userId)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    return handleAuthError(error)
  }
}

/**
 * PATCH /api/users/[id] - Update user (admin only)
 */
async function patchHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    const { id } = await params
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await request.json()

    // Validate request body
    const validationResult = updateUserSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    // Prevent admin from demoting themselves
    if (userId === admin.userId && validationResult.data.role === 'user') {
      return NextResponse.json(
        { error: 'Cannot demote yourself from admin' },
        { status: 403 }
      )
    }

    const user = await UserService.updateUser(userId, validationResult.data)

    return NextResponse.json({ user })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message.includes('Authentication')) {
        return handleAuthError(error)
      }
    }

    logger.error('Failed to update user', { error: error instanceof Error ? error.message : error })
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[id] - Delete user (admin only)
 */
async function deleteHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    const { id } = await params
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    // Prevent self-deletion
    if (userId === admin.userId) {
      return NextResponse.json(
        { error: 'Cannot delete yourself' },
        { status: 403 }
      )
    }

    await UserService.deleteUser(userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message.includes('last admin')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      if (error.message.includes('Authentication')) {
        return handleAuthError(error)
      }
    }

    logger.error('Failed to delete user', { error: error instanceof Error ? error.message : error })
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler)
export const PATCH = withLogging(patchHandler)
export const DELETE = withLogging(deleteHandler)

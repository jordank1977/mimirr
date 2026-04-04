import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { hashPassword } from '@/lib/utils/crypto'
import { logger } from '@/lib/utils/logger'
import { withLogging } from '@/lib/middleware/logging.middleware'

export const dynamic = 'force-dynamic'

/**
 * Check if setup is needed
 */
async function getHandler() {
  try {
    const userCount = await db.select().from(users)
    const needsSetup = userCount.length === 0

    return NextResponse.json({ needsSetup })
  } catch (error: any) {
    logger.error('Failed to check setup status', { error: error instanceof Error ? error.message : error })
    return NextResponse.json(
      { error: 'Failed to check setup status' },
      { status: 500 }
    )
  }
}

/**
 * Create initial admin account
 */
async function postHandler(request: NextRequest) {
  try {
    // Check if setup is already complete
    const userCount = await db.select().from(users)

    if (userCount.length > 0) {
      return NextResponse.json(
        { error: 'Setup already completed' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { username, email, password, displayName } = body

    // Validation
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create admin user
    await db.insert(users).values({
      username,
      email,
      passwordHash,
      displayName: displayName || username,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    logger.info('Initial admin account created via setup wizard', { username, email })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Setup failed', { error: error instanceof Error ? error.message : error })
    return NextResponse.json(
      { error: 'Failed to create admin account' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler)
export const POST = withLogging(postHandler)

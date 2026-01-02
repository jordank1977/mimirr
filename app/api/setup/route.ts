import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { hashPassword } from '@/lib/utils/crypto'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * Check if setup is needed
 */
export async function GET() {
  try {
    console.log('DEBUG: Attempting to query users table...')
    const userCount = await db.select().from(users)
    console.log('DEBUG: Query successful, user count:', userCount.length)
    const needsSetup = userCount.length === 0

    return NextResponse.json({ needsSetup })
  } catch (error: any) {
    console.error('DEBUG: Database error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      rawError: error
    })
    logger.error('Failed to check setup status', { error })
    return NextResponse.json(
      { error: 'Failed to check setup status' },
      { status: 500 }
    )
  }
}

/**
 * Create initial admin account
 */
export async function POST(request: NextRequest) {
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
    logger.error('Setup failed', { error })
    return NextResponse.json(
      { error: 'Failed to create admin account' },
      { status: 500 }
    )
  }
}

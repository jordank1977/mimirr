import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import { loginSchema } from '@/lib/utils/validation'
import { setAuthCookie } from '@/lib/middleware/auth.middleware'
import { logger } from '@/lib/utils/logger'
import { withLogging } from '@/lib/middleware/logging.middleware'
import { db, sessions } from '@/lib/db'
import { lt } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

async function loginHandler(request: NextRequest) {
  try {
    // Cleanup expired sessions
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

    const body = await request.json()

    // Validate input
    const validatedData = loginSchema.parse(body)

    // Login user
    const { user, token } = await AuthService.login(validatedData)

    // Create response
    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    })

    // Set auth cookie
    setAuthCookie(response, token)

    return response
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Login error', { error: error.message })
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    logger.error('Unexpected login error', { error: error instanceof Error ? error.message : error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = withLogging(loginHandler)

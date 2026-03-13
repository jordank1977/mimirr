import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import { registerSchema } from '@/lib/utils/validation'
import { setAuthCookie } from '@/lib/middleware/auth.middleware'
import { logger } from '@/lib/utils/logger'
import { withLogging } from '@/lib/middleware/logging.middleware'

export const dynamic = 'force-dynamic'

async function registerHandler(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validatedData = registerSchema.parse(body)

    // Register user
    const { user, token } = await AuthService.register(validatedData)

    // Create response
    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      },
      { status: 201 }
    )

    // Set auth cookie
    setAuthCookie(response, token)

    return response
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Registration error', { error: error.message })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.error('Unexpected registration error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = withLogging(registerHandler)

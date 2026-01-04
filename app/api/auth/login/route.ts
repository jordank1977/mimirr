import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import { loginSchema } from '@/lib/utils/validation'
import { setAuthCookie } from '@/lib/middleware/auth.middleware'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
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

    logger.error('Unexpected login error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

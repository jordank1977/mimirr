import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { AuthService } from '@/lib/services/auth.service'
import { withLogging } from '@/lib/middleware/logging.middleware'

export const dynamic = 'force-dynamic'

async function sessionHandler(request: NextRequest) {
  try {
    const payload = await requireAuth(request)
    const user = await AuthService.getUserById(payload.userId)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    })
  } catch (error) {
    return handleAuthError(error)
  }
}

export const GET = withLogging(sessionHandler)

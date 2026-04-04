import { NextRequest, NextResponse } from 'next/server'
import { clearAuthCookie, getTokenFromRequest } from '@/lib/middleware/auth.middleware'
import { withLogging } from '@/lib/middleware/logging.middleware'
import { db, sessions } from '@/lib/db'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

async function logoutHandler(request: NextRequest) {
  const token = getTokenFromRequest(request)

  if (token) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
    await db.delete(sessions).where(eq(sessions.token, hashedToken))
  }

  const response = NextResponse.json({ message: 'Logged out successfully' })
  clearAuthCookie(response)
  return response
}

export const POST = withLogging(logoutHandler)

import { NextResponse } from 'next/server'
import { clearAuthCookie } from '@/lib/middleware/auth.middleware'
import { withLogging } from '@/lib/middleware/logging.middleware'

export const dynamic = 'force-dynamic'

async function logoutHandler() {
  const response = NextResponse.json({ message: 'Logged out successfully' })
  clearAuthCookie(response)
  return response
}

export const POST = withLogging(logoutHandler)

import { NextResponse } from 'next/server'
import { clearAuthCookie } from '@/lib/middleware/auth.middleware'

export const dynamic = 'force-dynamic'

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out successfully' })
  clearAuthCookie(response)
  return response
}

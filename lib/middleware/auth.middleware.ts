import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT, type JWTPayload } from '@/lib/utils/jwt'
import { logger } from '@/lib/utils/logger'

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * Extract JWT token from request cookies
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get('auth_token')?.value || null
}

/**
 * Verify authentication and return user payload
 */
export async function requireAuth(request: NextRequest): Promise<JWTPayload> {
  const token = getTokenFromRequest(request)

  if (!token) {
    throw new AuthError('Authentication required', 401)
  }

  try {
    const payload = verifyJWT(token)
    return payload
  } catch (error) {
    logger.error('JWT verification failed', { error })
    throw new AuthError('Invalid or expired token', 401)
  }
}

/**
 * Require admin role
 */
export async function requireAdmin(request: NextRequest): Promise<JWTPayload> {
  const payload = await requireAuth(request)

  if (payload.role !== 'admin') {
    throw new AuthError('Admin access required', 403)
  }

  return payload
}

/**
 * Error handler middleware
 */
export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    )
  }

  logger.error('Unexpected error in auth middleware', { error })
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}

/**
 * Set authentication cookie
 */
export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && !process.env.DISABLE_HTTPS_COOKIES,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie(response: NextResponse): void {
  response.cookies.delete('auth_token')
}

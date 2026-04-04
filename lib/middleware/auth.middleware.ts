import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { db, sessions, users } from '@/lib/db'
import { eq, and, gt } from 'drizzle-orm'
import crypto from 'crypto'

export interface SessionPayload {
  userId: number
  role: 'admin' | 'user'
}

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
export async function requireAuth(request: NextRequest): Promise<SessionPayload> {
  const token = getTokenFromRequest(request)

  if (!token) {
    throw new AuthError('Authentication required', 401)
  }

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    // Look up the session and join with the user table to get the role
    const result = await db
      .select({
        userId: sessions.userId,
        role: users.role,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.token, hashedToken),
          gt(sessions.expiresAt, new Date())
        )
      )
      .limit(1)

    if (result.length === 0) {
      throw new AuthError('Invalid or expired token', 401)
    }

    return {
      userId: result[0].userId,
      role: result[0].role as 'admin' | 'user',
    }
  } catch (error) {
    if (error instanceof AuthError) {
      throw error
    }
    logger.error('Session verification failed', { error: error instanceof Error ? error.message : error })
    throw new AuthError('Invalid or expired token', 401)
  }
}

/**
 * Require admin role
 */
export async function requireAdmin(request: NextRequest): Promise<SessionPayload> {
  const payload = await requireAuth(request)

  if (payload.role !== 'admin') {
    logger.trace('Admin authorization rejected', { userId: payload.userId, role: payload.role, path: request.nextUrl.pathname })
    throw new AuthError('Admin access required', 403)
  }

  logger.trace('Admin authorization successful', { userId: payload.userId, path: request.nextUrl.pathname })
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

  logger.error('Unexpected error in auth middleware', { error: error instanceof Error ? error.message : error })
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
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie(response: NextResponse): void {
  response.cookies.delete('auth_token')
}

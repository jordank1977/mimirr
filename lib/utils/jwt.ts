import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { logger } from './logger'

// Auto-generate a secure JWT secret if not provided
// NOTE: This will change on every restart if not set, invalidating all tokens
const JWT_SECRET =
  process.env.JWT_SECRET ||
  (() => {
    const generated = crypto.randomBytes(32).toString('base64')
    logger.warn(
      'JWT_SECRET not set - using auto-generated secret. ' +
        'Set JWT_SECRET environment variable to persist sessions across restarts.'
    )
    return generated
  })()

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

export interface JWTPayload {
  userId: number
  role: 'admin' | 'user'
}

/**
 * Sign a JWT token
 */
export function signJWT(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as any)
}

/**
 * Verify and decode a JWT token
 */
export function verifyJWT(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    return decoded
  } catch (error) {
    throw new Error('Invalid or expired token')
  }
}

import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const SALT_ROUNDS = 12

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Compare two strings securely to prevent timing attacks
 * Handles null/undefined values and length mismatches safely
 */
export function timingSafeCompare(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (a == null || b == null) {
    return false
  }

  try {
    const aBuffer = Buffer.from(a, 'utf-8')
    const bBuffer = Buffer.from(b, 'utf-8')

    if (aBuffer.length !== bBuffer.length) {
      // Still do a comparison to avoid timing difference based on length
      crypto.timingSafeEqual(aBuffer, aBuffer)
      return false
    }

    return crypto.timingSafeEqual(aBuffer, bBuffer)
  } catch (error) {
    return false
  }
}

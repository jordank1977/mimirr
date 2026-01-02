import { db, users, type User, type NewUser } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/utils/crypto'
import { signJWT } from '@/lib/utils/jwt'
import { logger } from '@/lib/utils/logger'
import { eq } from 'drizzle-orm'

export class AuthService {
  /**
   * Register a new user
   */
  static async register(data: {
    username: string
    email: string
    password: string
    displayName?: string
  }): Promise<{ user: User; token: string }> {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, data.username))
      .limit(1)

    if (existingUser.length > 0) {
      throw new Error('Username already exists')
    }

    const existingEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1)

    if (existingEmail.length > 0) {
      throw new Error('Email already exists')
    }

    // Check if this is the first user (make them admin)
    const userCount = await db.select().from(users)
    const isFirstUser = userCount.length === 0

    // Hash password
    const passwordHash = await hashPassword(data.password)

    // Create user
    const newUser: NewUser = {
      username: data.username,
      email: data.email,
      passwordHash,
      displayName: data.displayName || data.username,
      role: isFirstUser ? 'admin' : 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db.insert(users).values(newUser).returning()
    const user = result[0]

    logger.info('User registered', { userId: user.id, username: user.username })

    // Generate JWT token
    const token = signJWT({ userId: user.id, role: user.role })

    return { user, token }
  }

  /**
   * Login a user
   */
  static async login(data: {
    username: string
    password: string
  }): Promise<{ user: User; token: string }> {
    // Find user by username
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, data.username))
      .limit(1)

    if (result.length === 0) {
      throw new Error('Invalid credentials')
    }

    const user = result[0]

    // Verify password
    const isValid = await verifyPassword(data.password, user.passwordHash)
    if (!isValid) {
      throw new Error('Invalid credentials')
    }

    // Update last login time
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id))

    logger.info('User logged in', { userId: user.id, username: user.username })

    // Generate JWT token
    const token = signJWT({ userId: user.id, role: user.role })

    return { user, token }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: number): Promise<User | null> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    return result[0] || null
  }

}

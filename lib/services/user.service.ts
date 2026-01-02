import { db, users, requests, settings, type User, type NewUser } from '@/lib/db'
import { eq, desc } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'
import { hashPassword } from '@/lib/utils/crypto'

export interface CreateUserInput {
  username: string
  email: string
  password: string
  displayName?: string
  role?: 'admin' | 'user'
}

export interface UpdateUserInput {
  displayName?: string
  email?: string
  password?: string
  role?: 'admin' | 'user'
}

export class UserService {
  /**
   * Get all users (exclude password hash)
   */
  static async getAllUsers(): Promise<Omit<User, 'passwordHash'>[]> {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          displayName: users.displayName,
          avatar: users.avatar,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt))

      return allUsers
    } catch (error) {
      logger.error('Failed to get all users', { error })
      throw new Error('Failed to retrieve users')
    }
  }

  /**
   * Get user by ID (exclude password hash)
   */
  static async getUserById(userId: number): Promise<Omit<User, 'passwordHash'> | null> {
    try {
      const result = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          displayName: users.displayName,
          avatar: users.avatar,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      return result[0] || null
    } catch (error) {
      logger.error('Failed to get user by ID', { error, userId })
      return null
    }
  }

  /**
   * Create a new user (admin only)
   */
  static async createUser(data: CreateUserInput): Promise<Omit<User, 'passwordHash'>> {
    try {
      // Check username uniqueness
      const existingUsername = await db
        .select()
        .from(users)
        .where(eq(users.username, data.username))
        .limit(1)

      if (existingUsername.length > 0) {
        throw new Error('Username already exists')
      }

      // Check email uniqueness
      const existingEmail = await db
        .select()
        .from(users)
        .where(eq(users.email, data.email))
        .limit(1)

      if (existingEmail.length > 0) {
        throw new Error('Email already exists')
      }

      // Hash password
      const passwordHash = await hashPassword(data.password)

      // Create user
      const newUser: NewUser = {
        username: data.username,
        email: data.email,
        passwordHash,
        displayName: data.displayName || data.username,
        role: data.role || 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await db.insert(users).values(newUser).returning()

      logger.info('User created by admin', {
        userId: result[0].id,
        username: result[0].username,
        role: result[0].role,
      })

      // Return user without password hash
      const { passwordHash: _, ...userWithoutPassword } = result[0]
      return userWithoutPassword
    } catch (error) {
      logger.error('Failed to create user', { error, username: data.username })
      throw error
    }
  }

  /**
   * Update user (admin only)
   */
  static async updateUser(
    userId: number,
    data: UpdateUserInput
  ): Promise<Omit<User, 'passwordHash'>> {
    try {
      const updateData: Partial<User> = {
        updatedAt: new Date(),
      }

      // Add fields to update
      if (data.displayName !== undefined) {
        updateData.displayName = data.displayName
      }
      if (data.email !== undefined) {
        updateData.email = data.email
      }
      if (data.role !== undefined) {
        updateData.role = data.role
      }

      // If password is being updated, hash it
      if (data.password) {
        updateData.passwordHash = await hashPassword(data.password)
      }

      const result = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning()

      if (result.length === 0) {
        throw new Error('User not found')
      }

      logger.info('User updated', { userId, fields: Object.keys(data) })

      // Return user without password hash
      const { passwordHash: _, ...userWithoutPassword } = result[0]
      return userWithoutPassword
    } catch (error) {
      logger.error('Failed to update user', { error, userId })
      throw error
    }
  }

  /**
   * Delete user (admin only)
   */
  static async deleteUser(userId: number): Promise<void> {
    try {
      // Check if user exists
      const user = await this.getUserById(userId)
      if (!user) {
        throw new Error('User not found')
      }

      // If deleting an admin, ensure at least one admin remains
      if (user.role === 'admin') {
        const adminCount = await db
          .select()
          .from(users)
          .where(eq(users.role, 'admin'))

        if (adminCount.length <= 1) {
          throw new Error('Cannot delete the last admin user')
        }
      }

      // Before deleting user, clear foreign key references to avoid constraint errors
      // Set processedBy to NULL in requests table
      await db
        .update(requests)
        .set({ processedBy: null })
        .where(eq(requests.processedBy, userId))

      // Set updatedBy to NULL in settings table
      await db
        .update(settings)
        .set({ updatedBy: null })
        .where(eq(settings.updatedBy, userId))

      // Now delete the user (this will cascade delete their own requests via userId FK)
      await db.delete(users).where(eq(users.id, userId))

      logger.info('User deleted', { userId, username: user.username })
    } catch (error) {
      logger.error('Failed to delete user', { error, userId })
      throw error
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(): Promise<{
    total: number
    admins: number
    regularUsers: number
  }> {
    try {
      const allUsers = await db.select().from(users)

      return {
        total: allUsers.length,
        admins: allUsers.filter((u) => u.role === 'admin').length,
        regularUsers: allUsers.filter((u) => u.role === 'user').length,
      }
    } catch (error) {
      logger.error('Failed to get user stats', { error })
      throw new Error('Failed to retrieve user statistics')
    }
  }
}

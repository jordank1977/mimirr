import { db, notificationSettings, notifications, users } from '@/lib/db'
import { eq, desc, and } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'
import type { NewNotification } from '@/lib/db/schema'

export type NotificationType =
  | 'request_approved'
  | 'request_declined'
  | 'request_available'
  | 'request_submitted'
  | 'bookshelf_error'

interface DiscordEmbed {
  title: string
  description: string
  color: number
  timestamp?: string
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  thumbnail?: {
    url: string
  }
}

interface DiscordWebhookPayload {
  username?: string
  avatar_url?: string
  embeds: DiscordEmbed[]
}

export class NotificationService {
  /**
   * Get notification settings
   */
  static async getSettings() {
    try {
      const result = await db
        .select()
        .from(notificationSettings)
        .where(eq(notificationSettings.id, 1))
        .limit(1)

      return result[0] || null
    } catch (error) {
      logger.error('Failed to get notification settings', { error })
      return null
    }
  }

  /**
   * Update notification settings
   */
  static async updateSettings(data: {
    discordEnabled?: boolean
    discordWebhookUrl?: string
    discordBotUsername?: string
    discordBotAvatarUrl?: string
    notifyRequestApproved?: boolean
    notifyRequestDeclined?: boolean
    notifyRequestAvailable?: boolean
    notifyRequestSubmitted?: boolean
    notifyBookshelfError?: boolean
  }) {
    try {
      const settings = await this.getSettings()
      
      const updateData: any = {
        updatedAt: new Date(),
      }

      if (typeof data.discordEnabled === 'boolean') {
        updateData.discordEnabled = data.discordEnabled
      }
      if (data.discordWebhookUrl !== undefined) {
        updateData.discordWebhookUrl = data.discordWebhookUrl
      }
      if (data.discordBotUsername !== undefined) {
        updateData.discordBotUsername = data.discordBotUsername
      }
      if (data.discordBotAvatarUrl !== undefined) {
        updateData.discordBotAvatarUrl = data.discordBotAvatarUrl
      }
      if (typeof data.notifyRequestApproved === 'boolean') {
        updateData.notifyRequestApproved = data.notifyRequestApproved
      }
      if (typeof data.notifyRequestDeclined === 'boolean') {
        updateData.notifyRequestDeclined = data.notifyRequestDeclined
      }
      if (typeof data.notifyRequestAvailable === 'boolean') {
        updateData.notifyRequestAvailable = data.notifyRequestAvailable
      }
      if (typeof data.notifyRequestSubmitted === 'boolean') {
        updateData.notifyRequestSubmitted = data.notifyRequestSubmitted
      }
      if (typeof data.notifyBookshelfError === 'boolean') {
        updateData.notifyBookshelfError = data.notifyBookshelfError
      }

      if (!settings) {
        // Create settings if they don't exist
        const result = await db
          .insert(notificationSettings)
          .values({
            id: 1,
            ...updateData,
            createdAt: new Date(),
          })
          .returning()
        
        return result[0]
      }

      const result = await db
        .update(notificationSettings)
        .set(updateData)
        .where(eq(notificationSettings.id, 1))
        .returning()

      return result[0]
    } catch (error) {
      logger.error('Failed to update notification settings', { error })
      throw error
    }
  }

  /**
   * Send Discord webhook notification (Overseerr-style format)
   */
  static async sendDiscordNotification(
    type: NotificationType,
    notificationTitle: string,
    bookTitle: string,
    bookAuthor: string,
    bookDescription: string,
    bookCoverImage: string | undefined,
    requestedBy: string,
    status: string,
    format: string
  ): Promise<boolean> {
    try {
      const settings = await this.getSettings()

      if (!settings || !settings.discordEnabled || !settings.discordWebhookUrl) {
        logger.debug('Discord notifications not configured or disabled')
        return false
      }

      // Check if this notification type is enabled
      const typeEnabled = this.isNotificationTypeEnabled(type, settings)
      if (!typeEnabled) {
        logger.debug(`Discord notification type ${type} is disabled`)
        return false
      }

      // Color based on notification type
      const color = this.getNotificationColor(type)

      // Truncate description if too long (Discord limit is 4096, we'll use 300 for readability)
      const truncatedDescription = bookDescription.length > 300
        ? bookDescription.substring(0, 297) + '...'
        : bookDescription

      const embed: DiscordEmbed = {
        title: `${notificationTitle}`,
        description: `**${bookTitle}**\n*${bookAuthor}*\n\n${truncatedDescription}`,
        color,
        timestamp: new Date().toISOString(),
        fields: [
          { name: 'Requested By', value: requestedBy, inline: true },
          { name: 'Request Status', value: status, inline: true },
          { name: 'Requested Format', value: format, inline: true },
        ],
      }

      // Add book cover as thumbnail if available
      if (bookCoverImage) {
        embed.thumbnail = {
          url: bookCoverImage,
        }
      }

      const payload: DiscordWebhookPayload = {
        username: settings.discordBotUsername || 'Mimirr',
        avatar_url: settings.discordBotAvatarUrl || undefined,
        embeds: [embed],
      }

      const response = await fetch(settings.discordWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.statusText}`)
      }

      logger.info('Discord notification sent', { type, notificationTitle })
      return true
    } catch (error) {
      logger.error('Failed to send Discord notification', { error, type, notificationTitle })
      return false
    }
  }

  /**
   * Create in-app notification
   */
  static async createNotification(
    userId: number,
    type: NotificationType,
    title: string,
    message: string,
    link?: string
  ): Promise<void> {
    try {
      const notification: NewNotification = {
        userId,
        type,
        title,
        message,
        link,
      }

      await db.insert(notifications).values(notification)
      logger.info('In-app notification created', { userId, type, title })
    } catch (error) {
      logger.error('Failed to create in-app notification', { error, userId, type })
      throw error
    }
  }

  /**
   * Send notification (both Discord and in-app)
   */
  static async sendNotification(
    userId: number | number[], // Can be single user or array for admins
    type: NotificationType,
    notificationTitle: string,
    bookTitle: string,
    bookAuthor: string,
    bookDescription: string,
    bookCoverImage: string | undefined,
    requestedBy: string,
    status: string,
    format: string,
    link?: string
  ): Promise<void> {
    try {
      // Send Discord notification
      await this.sendDiscordNotification(
        type,
        notificationTitle,
        bookTitle,
        bookAuthor,
        bookDescription,
        bookCoverImage,
        requestedBy,
        status,
        format
      )

      // Create in-app notifications
      const userIds = Array.isArray(userId) ? userId : [userId]
      logger.info('Creating in-app notifications', {
        type,
        title: notificationTitle,
        userIds,
        userCount: userIds.length
      })

      // For in-app notifications, use a simplified message
      const inAppMessage = `${bookTitle} - ${status}`

      for (const uid of userIds) {
        await this.createNotification(uid, type, notificationTitle, inAppMessage, link)
      }

      logger.info('In-app notifications created successfully', {
        type,
        userCount: userIds.length
      })
    } catch (error) {
      logger.error('Failed to send notification', { error, userId, type })
    }
  }

  /**
   * Get all admin user IDs
   */
  static async getAdminUserIds(): Promise<number[]> {
    try {
      const admins = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.role, 'admin'))

      const adminIds = admins.map((a) => a.id)
      logger.info('Found admin users', {
        count: admins.length,
        admins: admins.map(a => ({ id: a.id, username: a.username }))
      })

      return adminIds
    } catch (error) {
      logger.error('Failed to get admin user IDs', { error })
      return []
    }
  }

  /**
   * Get notifications for a user
   */
  static async getUserNotifications(userId: number, limit = 50) {
    try {
      const result = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)

      logger.debug('Retrieved notifications for user', { userId, count: result.length })
      return result
    } catch (error) {
      logger.error('Failed to get user notifications', { error, userId })
      return []
    }
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId: number): Promise<number> {
    try {
      const result = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))

      return result.length
    } catch (error) {
      logger.error('Failed to get unread count', { error, userId })
      return 0
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: number, userId: number): Promise<void> {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    } catch (error) {
      logger.error('Failed to mark notification as read', { error, notificationId })
      throw error
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: number): Promise<void> {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, userId))
    } catch (error) {
      logger.error('Failed to mark all notifications as read', { error, userId })
      throw error
    }
  }

  /**
   * Test Discord webhook
   */
  static async testDiscordWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const payload: DiscordWebhookPayload = {
        username: 'Mimirr',
        embeds: [
          {
            title: 'Test Notification',
            description: 'This is a test notification from Mimirr. Your Discord webhook is configured correctly!',
            color: 0x8b5cf6, // Purple color
            timestamp: new Date().toISOString(),
          },
        ],
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      return response.ok
    } catch (error) {
      logger.error('Failed to test Discord webhook', { error })
      return false
    }
  }

  /**
   * Check if notification type is enabled in settings
   */
  private static isNotificationTypeEnabled(
    type: NotificationType,
    settings: any
  ): boolean {
    switch (type) {
      case 'request_approved':
        return settings.notifyRequestApproved
      case 'request_declined':
        return settings.notifyRequestDeclined
      case 'request_available':
        return settings.notifyRequestAvailable
      case 'request_submitted':
        return settings.notifyRequestSubmitted
      case 'bookshelf_error':
        return settings.notifyBookshelfError
      default:
        return false
    }
  }

  /**
   * Get color for notification type (Discord embed color)
   */
  private static getNotificationColor(type: NotificationType): number {
    switch (type) {
      case 'request_approved':
        return 0x22c55e // Green
      case 'request_declined':
        return 0xef4444 // Red
      case 'request_available':
        return 0x3b82f6 // Blue
      case 'request_submitted':
        return 0xf59e0b // Amber
      case 'bookshelf_error':
        return 0xef4444 // Red
      default:
        return 0x8b5cf6 // Purple (default)
    }
  }
}

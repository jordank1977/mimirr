import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// Users table
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  avatar: text('avatar'),
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
})

// Requests table
export const requests = sqliteTable('requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull(), // Goodreads work ID
  status: text('status', {
    enum: ['pending', 'approved', 'declined', 'available', 'processing'],
  })
    .notNull()
    .default('pending'),
  qualityProfileId: integer('quality_profile_id').notNull(), // Bookshelf quality profile ID
  bookshelfId: integer('bookshelf_id'), // ID in Bookshelf system
  requestedAt: integer('requested_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
  processedBy: integer('processed_by').references(() => users.id),
  notes: text('notes'),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  lastPolledAt: integer('last_polled_at', { mode: 'timestamp' }),
  foreignBookId: text('foreign_book_id'),
  foreignAuthorId: text('foreign_author_id'),
  monitoringOption: text('monitoring_option'),
})

// Book cache table
export const bookCache = sqliteTable('book_cache', {
  id: text('id').primaryKey(), // Hardcover book ID
  title: text('title').notNull(),
  author: text('author'),
  coverImage: text('cover_image'),
  description: text('description'),
  isbn: text('isbn'),
  isbn13: text('isbn13'),
  publishedDate: text('published_date'),
  publisher: text('publisher'),
  pageCount: integer('page_count'),
  genres: text('genres'), // JSON stringified array
  rating: text('rating'), // Store as text for precision
  metadata: text('metadata'), // Full JSON of Hardcover response
  cachedAt: integer('cached_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  lastAccessedAt: integer('last_accessed_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

// Settings table
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value').notNull(), // JSON stringified
  category: text('category').notNull(), // 'bookshelf', 'general', 'notifications'
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedBy: integer('updated_by').references(() => users.id),
})

// Notification settings table
export const notificationSettings = sqliteTable('notification_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  discordEnabled: integer('discord_enabled', { mode: 'boolean' }).notNull().default(false),
  discordWebhookUrl: text('discord_webhook_url'),
  discordBotUsername: text('discord_bot_username').default('Mimirr'),
  discordBotAvatarUrl: text('discord_bot_avatar_url'),
  notifyRequestApproved: integer('notify_request_approved', { mode: 'boolean' }).notNull().default(true),
  notifyRequestDeclined: integer('notify_request_declined', { mode: 'boolean' }).notNull().default(true),
  notifyRequestAvailable: integer('notify_request_available', { mode: 'boolean' }).notNull().default(true),
  notifyRequestSubmitted: integer('notify_request_submitted', { mode: 'boolean' }).notNull().default(true),
  notifyBookshelfError: integer('notify_bookshelf_error', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

// Notifications table
export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', {
    enum: ['request_approved', 'request_declined', 'request_available', 'request_submitted', 'bookshelf_error'],
  }).notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  link: text('link'), // Optional link to relevant page
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

// User preferences table (for personalized recommendations)
export const userPreferences = sqliteTable('user_preferences', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  genreWeights: text('genre_weights').notNull(), // JSON: {genre: weight, ...}
  authorPreferences: text('author_preferences').notNull(), // JSON: [{name, weight}, ...]
  topGenres: text('top_genres').notNull(), // JSON: [genre1, genre2, ...]
  topAuthors: text('top_authors').notNull(), // JSON: [author1, author2, ...]
  totalRequests: integer('total_requests').notNull().default(0),
  lastRequestDate: integer('last_request_date', { mode: 'timestamp' }),
  recommendedPopularBooks: text('recommended_popular_books'), // JSON: [bookId1, bookId2, ...]
  recommendedNewBooks: text('recommended_new_books'), // JSON: [bookId1, bookId2, ...]
  recommendedAuthorBooks: text('recommended_author_books'), // JSON: [bookId1, bookId2, ...]
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

// Quality profile configurations table
export const qualityProfileConfigs = sqliteTable('quality_profile_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profile_id').notNull().unique(),
  profileName: text('profile_name').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  orderIndex: integer('order_index').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

// Type exports for use in application
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Request = typeof requests.$inferSelect
export type NewRequest = typeof requests.$inferInsert
export type BookCache = typeof bookCache.$inferSelect
export type NewBookCache = typeof bookCache.$inferInsert
export type Setting = typeof settings.$inferSelect
export type NewSetting = typeof settings.$inferInsert
export type NotificationSettings = typeof notificationSettings.$inferSelect
export type NewNotificationSettings = typeof notificationSettings.$inferInsert
export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
export type UserPreferences = typeof userPreferences.$inferSelect
export type NewUserPreferences = typeof userPreferences.$inferInsert
export type QualityProfileConfig = typeof qualityProfileConfigs.$inferSelect
export type NewQualityProfileConfig = typeof qualityProfileConfigs.$inferInsert

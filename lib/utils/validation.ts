import { z } from 'zod'

// Auth schemas
export const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, hyphens, and underscores'
    ),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must be less than 100 characters'),
  displayName: z.string().max(100).optional(),
})

// Request schemas
export const createRequestSchema = z.object({
  bookId: z.string().min(1, 'Book ID is required'),
  qualityProfileId: z.number().int().positive('Quality profile ID is required'),
  notes: z.string().max(500).optional(),
})

export const createOnlyThisBookRequestSchema = z.object({
  foreignBookId: z.string().min(1, 'Foreign book ID is required'),
  foreignAuthorId: z.string().min(1, 'Foreign author ID is required'),
  title: z.string().min(1, 'Title is required'),
  authorName: z.string().min(1, 'Author name is required'),
  monitoringOption: z.literal('specificBook'),
  qualityProfileId: z.number().int().positive('Quality profile ID is required'),
  notes: z.string().max(500).optional(),
})

export const updateRequestSchema = z.object({
  status: z.enum(['pending', 'approved', 'declined', 'available', 'processing']),
  notes: z.string().max(500).optional(),
})

// Settings schemas
export const bookshelfSettingsSchema = z.object({
  url: z.string().url('Invalid URL'),
  apiKey: z.string().min(1, 'API key is required'),
})

// User schemas
export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, hyphens, and underscores'
    ),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must be less than 100 characters'),
  displayName: z.string().max(100).optional(),
  role: z.enum(['admin', 'user']).default('user'),
})

export const updateUserSchema = z.object({
  displayName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).max(100).optional(),
  role: z.enum(['admin', 'user']).optional(),
})

// Type exports
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type CreateRequestInput = z.infer<typeof createRequestSchema>
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>
export type BookshelfSettingsInput = z.infer<typeof bookshelfSettingsSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>

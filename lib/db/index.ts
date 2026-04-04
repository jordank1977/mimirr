import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from './schema'
import { logger } from '@/lib/utils/logger'

// Initialize database connection
function initializeDb(): LibSQLDatabase<typeof schema> {
  // Read DATABASE_URL at RUNTIME, not at module load
  const databaseUrl = process.env.DATABASE_URL || 'file:./config/db.sqlite'

  const client = createClient({
    url: databaseUrl,
  })
  const dbInstance = drizzle(client, { schema })

  logger.info('[DB] Database connection initialized', { databaseUrl })
  return dbInstance
}

// Next.js HMR Database Connection Cache
// In development, Next.js clears the module cache on every reload, which can lead to
// database connection exhaustion and memory leaks. We cache the connection on globalThis.
const globalForDb = globalThis as unknown as { sqlite: LibSQLDatabase<typeof schema> | undefined }

// Export the active database connection
export const db = globalForDb.sqlite ?? initializeDb()

// In development, preserve the database connection across HMR reloads
if (process.env.NODE_ENV !== 'production') {
  globalForDb.sqlite = db
}

// Export schema for use in application
export * from './schema'

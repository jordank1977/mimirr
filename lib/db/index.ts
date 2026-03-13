import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from './schema'

// Cache the database instance
let _db: LibSQLDatabase<typeof schema> | null = null

// Lazy initialization function - called on first access
function getDatabase(): LibSQLDatabase<typeof schema> {
  if (!_db) {
    // Read DATABASE_URL at RUNTIME, not at module load
    const databaseUrl = process.env.DATABASE_URL || 'file:./config/db.sqlite'

    const client = createClient({
      url: databaseUrl,
    })
    _db = drizzle(client, { schema })

    console.log('[DB] Database connection initialized:', databaseUrl)
  }
  return _db
}

// Export a Proxy that lazily initializes on first access
export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_target, prop) {
    return (getDatabase() as any)[prop]
  },
})

// Export schema for use in application
export * from './schema'

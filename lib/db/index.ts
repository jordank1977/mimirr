import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from './schema'

const databaseUrl = process.env.DATABASE_URL || 'file:./config/db.sqlite'

// Lazy database connection - only initialize when actually used
let _db: LibSQLDatabase<typeof schema> | null = null

function getDatabase() {
  if (!_db) {
    const client = createClient({
      url: databaseUrl,
    })
    _db = drizzle(client, { schema })
  }
  return _db
}

// Export db as a getter to enable lazy initialization
export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_target, prop) {
    return (getDatabase() as any)[prop]
  }
})

// Export schema for use in application
export * from './schema'

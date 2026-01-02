import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from './schema'

// Use relative path for local development
const databaseUrl = process.env.DATABASE_URL || 'file:./config/db.sqlite'

// Detect if we're in Next.js build mode (no runtime available)
const isBuildTime = typeof window === 'undefined' && process.env.NEXT_PHASE === 'phase-production-build'

// Create database connection (skip during build)
let db: LibSQLDatabase<typeof schema>

if (isBuildTime) {
  // During build, create a mock database object that won't be used
  db = {} as LibSQLDatabase<typeof schema>
} else {
  // At runtime, create actual database connection
  const client = createClient({
    url: databaseUrl,
  })
  db = drizzle(client, { schema })
}

export { db }

// Export schema for use in application
export * from './schema'

import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from './schema'

import path from 'path'

// Use relative path for local development
const databaseUrl = process.env.DATABASE_URL || 'file:./config/db.sqlite'

// Create database connection
const client = createClient({
  url: databaseUrl,
})

export const db = drizzle(client, { schema })

// Export schema for use in application
export * from './schema'

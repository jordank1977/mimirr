import type { Config } from 'drizzle-kit'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config() // fallback to .env

// Read DATABASE_URL at runtime, default to absolute path for Docker
const getDatabaseUrl = () => {
  return process.env.DATABASE_URL || 'file:/app/config/db.sqlite'
}

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: getDatabaseUrl(),
  },
} satisfies Config

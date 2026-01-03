import type { Config } from 'drizzle-kit'

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

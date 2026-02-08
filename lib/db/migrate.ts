import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createClient } from '@libsql/client'

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL || 'file:./config/db.sqlite'

  const client = createClient({
    url: databaseUrl,
  })

  const db = drizzle(client)

  console.log('Running migrations...')

  await migrate(db, { migrationsFolder: './lib/db/migrations' })

  console.log('Migrations completed successfully')
  process.exit(0)
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})

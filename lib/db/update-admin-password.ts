import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import { users } from './schema'
import { eq } from 'drizzle-orm'
import { hashPassword } from '@/lib/utils/crypto'
import { logger } from '@/lib/utils/logger'

async function updateAdminPassword() {
  const newPassword = process.env.ADMIN_PASSWORD
  if (!newPassword) {
    logger.error('ADMIN_PASSWORD environment variable is required. Usage: ADMIN_PASSWORD=your_new_password npm run db:reset-admin')
    process.exit(1)
  }

  const targetUsername = process.env.ADMIN_USERNAME || 'admin'
  const databaseUrl = process.env.DATABASE_URL || 'file:./config/db.sqlite'

  const client = createClient({
    url: databaseUrl,
  })

  const db = drizzle(client)

  const passwordHash = await hashPassword(newPassword)

  logger.info(`Updating password for user '${targetUsername}'...`)

  const result = await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.username, targetUsername))
    .returning()

  if (result.length === 0) {
    logger.error(`User '${targetUsername}' not found in the database.`)
    process.exit(1)
  }

  logger.info('✓ Admin password successfully updated.')

  process.exit(0)
}

updateAdminPassword().catch((err) => {
  logger.error('Update failed', { error: err instanceof Error ? err.message : err })
  process.exit(1)
})

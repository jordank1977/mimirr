import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import { users } from './schema'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'

async function updateAdminPassword() {
  const databaseUrl = process.env.DATABASE_URL || 'file:./config/db.sqlite'

  const client = createClient({
    url: databaseUrl,
  })

  const db = drizzle(client)

  const newPassword = 'admin123'
  const passwordHash = await bcrypt.hash(newPassword, 12)

  console.log('Updating admin password...')

  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.username, 'admin'))

  console.log('✓ Admin password updated successfully!')
  console.log(`✓ New credentials: admin / ${newPassword}`)

  process.exit(0)
}

updateAdminPassword().catch((err) => {
  console.error('Update failed:', err)
  process.exit(1)
})

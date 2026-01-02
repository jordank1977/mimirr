import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import { users } from './schema'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'

async function seed() {
  const databaseUrl = process.env.DATABASE_URL || 'file:./config/db.sqlite'

  const client = createClient({
    url: databaseUrl,
  })

  const db = drizzle(client)

  // Default admin credentials
  const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin'
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@localhost'
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123'

  console.log('Seeding database...')

  // Check if admin user already exists
  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get()

  if (existingAdmin) {
    console.log(`Admin user '${username}' already exists. Skipping.`)
    process.exit(0)
  }

  // Create admin user
  const passwordHash = await bcrypt.hash(password, 12)
  const now = new Date()

  await db.insert(users).values({
    username,
    email,
    passwordHash,
    displayName: 'Administrator',
    role: 'admin',
    createdAt: now,
    updatedAt: now,
  })

  console.log('✓ Database seeded successfully!')
  console.log(`✓ Admin user created: ${username} / ${password}`)
  console.log('⚠️  IMPORTANT: Change the admin password after first login!')

  process.exit(0)
}

seed().catch((err) => {
  console.error('Seeding failed:', err)
  process.exit(1)
})

import { createClient } from '@libsql/client'

async function checkSchema() {
  const databaseUrl = process.env.DATABASE_URL || 'file:./config/db.sqlite'

  const client = createClient({
    url: databaseUrl,
  })

  console.log('Checking requests table schema...')

  // Check if new columns exist
  try {
    const result = await client.execute('PRAGMA table_info(requests)')
    console.log('\nRequests table columns:')
    result.rows.forEach(row => {
      console.log(`  - ${row.name} (${row.type})`)
    })

    const hasCompletedAt = result.rows.some(row => row.name === 'completed_at')
    const hasLastPolledAt = result.rows.some(row => row.name === 'last_polled_at')

    console.log('\nNew columns status:')
    console.log(`  completed_at: ${hasCompletedAt ? '✓ exists' : '✗ missing'}`)
    console.log(`  last_polled_at: ${hasLastPolledAt ? '✓ exists' : '✗ missing'}`)

    if (!hasCompletedAt || !hasLastPolledAt) {
      console.log('\nApplying migration...')

      if (!hasCompletedAt) {
        await client.execute('ALTER TABLE requests ADD COLUMN completed_at INTEGER')
        console.log('  ✓ Added completed_at')
      }

      if (!hasLastPolledAt) {
        await client.execute('ALTER TABLE requests ADD COLUMN last_polled_at INTEGER')
        console.log('  ✓ Added last_polled_at')
      }

      console.log('\nMigration complete!')
    } else {
      console.log('\nAll columns exist ✓')
    }
  } catch (error) {
    console.error('Error:', error)
  }

  process.exit(0)
}

checkSchema()

import { createClient } from '@libsql/client'
import { logger } from '../lib/utils/logger'

async function checkSchema() {
  const databaseUrl = process.env.DATABASE_URL || 'file:./config/db.sqlite'

  const client = createClient({
    url: databaseUrl,
  })

  logger.info('Checking requests table schema...')

  // Check if new columns exist
  try {
    const result = await client.execute('PRAGMA table_info(requests)')

    const columns = result.rows.map(row => `${row.name} (${row.type})`)
    logger.info('Requests table columns:', { columns })

    const hasCompletedAt = result.rows.some(row => row.name === 'completed_at')
    const hasLastPolledAt = result.rows.some(row => row.name === 'last_polled_at')

    logger.info('New columns status:', {
      completed_at: hasCompletedAt ? '✓ exists' : '✗ missing',
      last_polled_at: hasLastPolledAt ? '✓ exists' : '✗ missing'
    })

    if (!hasCompletedAt || !hasLastPolledAt) {
      logger.info('Applying migration...')

      if (!hasCompletedAt) {
        await client.execute('ALTER TABLE requests ADD COLUMN completed_at INTEGER')
        logger.info('✓ Added completed_at')
      }

      if (!hasLastPolledAt) {
        await client.execute('ALTER TABLE requests ADD COLUMN last_polled_at INTEGER')
        logger.info('✓ Added last_polled_at')
      }

      logger.info('Migration complete!')
    } else {
      logger.info('All columns exist ✓')
    }
  } catch (error) {
    logger.error('Error in schema check', { error: error instanceof Error ? error.message : error })
  }

  process.exit(0)
}

checkSchema()

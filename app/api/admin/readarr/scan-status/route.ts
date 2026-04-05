import { NextRequest, NextResponse } from 'next/server'
import { db, syncJobs } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'
import { timingSafeCompare } from '@/lib/utils/crypto'
import { requireAdmin, AuthError } from '@/lib/middleware/auth.middleware'
import { withLogging } from '@/lib/middleware/logging.middleware'

export const dynamic = 'force-dynamic'

export const GET = withLogging(async function GET(request: NextRequest) {
  try {
    // 1. Authorization Check
    try {
      await requireAdmin(request)
    } catch (e) {
      if (e instanceof AuthError) {
        logger.warn('Unauthorized access attempt to readarr scan-status route')
        return new NextResponse('Unauthorized', { status: 401 })
      }
      throw e
    }

    // 2. Get latest job
    const latestJobs = await db
      .select()
      .from(syncJobs)
      .orderBy(desc(syncJobs.id))
      .limit(1)

    if (latestJobs.length === 0) {
      return NextResponse.json({
        job: { status: 'idle', currentLogMessage: 'No previous scans found.' }
      })
    }

    return NextResponse.json({ job: latestJobs[0] })
  } catch (error) {
    logger.error('Error fetching readarr scan status', { error: error instanceof Error ? error.message : error })
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
});

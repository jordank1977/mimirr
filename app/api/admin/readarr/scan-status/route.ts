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
    // 1. Dual-Authorization Check
    let isAuthorized = false

    // Attempt 1: NextAuth Session (UI User)
    try {
      await requireAdmin(request)
      isAuthorized = true
    } catch (e) {
      if (e instanceof AuthError) {
        // UI User failed, check fallback
      } else {
        throw e // Unexpected error
      }
    }

    // Attempt 2: Static Secret Key (Headless/Cron)
    if (!isAuthorized) {
      const adminKey = request.headers.get('x-mimirr-admin-key')
      const secretKey = process.env.SYNC_AUDIT_SECRET
      if (secretKey && adminKey && timingSafeCompare(adminKey, secretKey)) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      logger.warn('Unauthorized access attempt to readarr scan-status route')
      return new NextResponse('Unauthorized', { status: 401 })
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

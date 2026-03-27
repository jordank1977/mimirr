import { NextResponse } from 'next/server'
import { db, syncJobs } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'
import { timingSafeCompare } from '@/lib/utils/crypto'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // 1. Authorization
    const adminKey = request.headers.get('x-mimirr-admin-key')
    const secretKey = process.env.SYNC_AUDIT_SECRET

    if (!secretKey || !adminKey || !timingSafeCompare(adminKey, secretKey)) {
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
    logger.error('Error fetching readarr scan status', { error })
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

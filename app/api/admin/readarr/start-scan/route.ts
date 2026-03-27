import { NextResponse } from 'next/server'
import { db, syncJobs, settings } from '@/lib/db'
import { inArray, eq } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'
import { timingSafeCompare } from '@/lib/utils/crypto'
import { ReadarrJobOrchestrator } from '@/lib/services/orchestrator.service'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // 1. Authorization
    const adminKey = request.headers.get('x-mimirr-admin-key')
    const secretKey = process.env.SYNC_AUDIT_SECRET

    if (!secretKey || !adminKey || !timingSafeCompare(adminKey, secretKey)) {
      logger.warn('Unauthorized access attempt to readarr start-scan route')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // 2. Concurrency Lock
    const activeJobs = await db
      .select()
      .from(syncJobs)
      .where(eq(syncJobs.status, 'scanning'))
      .limit(1)

    if (activeJobs.length > 0) {
      return NextResponse.json(
        { error: 'A scan is already in progress.', jobId: activeJobs[0].id },
        { status: 409 }
      )
    }

    // 3. Fetch Configuration
    const urlSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'bookshelf_url'))
      .limit(1)

    const apiKeySetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'bookshelf_api_key'))
      .limit(1)

    const bookshelfUrl = urlSetting[0]?.value
    const bookshelfApiKey = apiKeySetting[0]?.value

    if (!bookshelfUrl || !bookshelfApiKey) {
      return NextResponse.json(
        { error: 'Bookshelf configuration missing. Cannot perform Baseline Sync.' },
        { status: 500 }
      )
    }

    const bookshelfConfig = {
      url: bookshelfUrl,
      apiKey: bookshelfApiKey,
    }

    // 4. Create new job
    const newJob = await db
      .insert(syncJobs)
      .values({
        status: 'scanning',
        currentLogMessage: 'Initializing scan...',
      })
      .returning()

    const jobId = newJob[0].id

    // 5. Start Background Execution
    // Do not await the orchestrator so we can return 202 Accepted immediately
    // Next.js might kill the context, but in standalone mode or with edge functions,
    // this can run asynchronously. For better Vercel support, waitUntil is used if available
    // but standard Promises work for standalone nodes.
    const runOrchestrator = async () => {
      await ReadarrJobOrchestrator.startJob(jobId, bookshelfConfig)
    }

    // Kick off in background
    runOrchestrator().catch((err) => {
      logger.error('Unhandled error in background orchestrator', { error: err })
    })

    return NextResponse.json(
      { success: true, message: 'Scan accepted and started in background.', jobId },
      { status: 202 }
    )
  } catch (error) {
    logger.error('Error starting readarr scan', { error })
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

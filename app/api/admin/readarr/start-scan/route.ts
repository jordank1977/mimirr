import { NextRequest, NextResponse } from 'next/server'
import { db, syncJobs, settings } from '@/lib/db'
import { inArray, eq } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'
import { timingSafeCompare } from '@/lib/utils/crypto'
import { ReadarrJobOrchestrator } from '@/lib/services/orchestrator.service'
import { requireAdmin, AuthError } from '@/lib/middleware/auth.middleware'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
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
      const activeJob = activeJobs[0]
      const startedAt = new Date(activeJob.startedAt).getTime()
      const now = Date.now()

      // Fail-safe: Release lock if scanning for > 2 hours
      if (now - startedAt > 2 * 60 * 60 * 1000) {
        logger.warn(`Stale sync job detected (ID: ${activeJob.id}). Clearing lock.`)
        await db.update(syncJobs)
          .set({
            status: 'error',
            currentLogMessage: 'Job timed out after 2 hours.',
            completedAt: new Date()
          })
          .where(eq(syncJobs.id, activeJob.id))
      } else {
        return NextResponse.json(
          { error: 'A scan is already in progress.', jobId: activeJobs[0].id },
          { status: 409 }
        )
      }
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

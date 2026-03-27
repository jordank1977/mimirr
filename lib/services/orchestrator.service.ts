import { db, syncJobs } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { SyncService } from './sync.service'
import { logger } from '@/lib/utils/logger'
import type { BookshelfConfig } from '@/types/bookshelf.types'

export class ReadarrJobOrchestrator {
  static async startJob(jobId: number, config: BookshelfConfig): Promise<void> {
    try {
      logger.info('Orchestrator starting Readarr job', { jobId })

      // 1. Mark job as scanning
      await db.update(syncJobs)
        .set({ status: 'scanning', currentLogMessage: 'Starting Baseline Sync with Readarr...' })
        .where(eq(syncJobs.id, jobId))

      // 2. Run Baseline Sync
      const report = await SyncService.reconcileWithReadarr(config, jobId)

      // 3. Mark job as complete
      await db.update(syncJobs)
        .set({
          status: 'complete',
          currentLogMessage: `Scan successfully completed. Added ${report.added} ghosts, removed ${report.orphaned} orphans, purged ${report.purged} metadata caches.`,
          completedAt: new Date()
        })
        .where(eq(syncJobs.id, jobId))

      logger.info('Orchestrator completed Readarr job successfully', { jobId })

    } catch (error: any) {
      logger.error('Orchestrator encountered error during Readarr job', { error, jobId })

      try {
        await db.update(syncJobs)
          .set({
            status: 'error',
            currentLogMessage: `Error: ${error.message || 'Unknown error occurred'}`,
            completedAt: new Date()
          })
          .where(eq(syncJobs.id, jobId))
      } catch (dbError) {
        logger.error('Failed to update sync job error status', { error: dbError, jobId })
      }
    }
  }
}

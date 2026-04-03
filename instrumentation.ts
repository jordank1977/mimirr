export const config = { runtime: 'nodejs' }

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logger } = await import('./lib/utils/logger')
    logger.info('Initializing instrumentation: Node.js runtime detected.')

    // Avoid running in Vercel Edge / build phase
    if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PHASE === 'phase-production-build') {
      return
    }

    // Initialize polling interval (ensure singleton behavior in dev)
    const { SyncService } = await import('./lib/services/sync.service')
    const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || '15', 10) || 15
    const intervalMs = intervalMinutes * 60 * 1000

    // Cast globalThis to any to handle custom property
    const globalAny = globalThis as any

    if (!globalAny.__mimirr_sync_interval) {
      logger.info(`Starting background sync polling engine. Interval: ${intervalMinutes} minutes.`)

      // Do not block initialization, run first sync asynchronously
      setTimeout(() => {
        SyncService.runBackgroundSync().catch(err => {
          logger.error('Error in initial background sync run', { error: err })
        })
      }, 5000) // Small delay to allow server to fully boot

      globalAny.__mimirr_sync_interval = setInterval(() => {
        SyncService.runBackgroundSync().catch(err => {
          logger.error('Error in scheduled background sync run', { error: err })
        })
      }, intervalMs)
    }
  }
}

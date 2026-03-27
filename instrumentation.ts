export const config = { runtime: 'nodejs' }

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logger } = await import('./lib/utils/logger')
    logger.info('Initializing instrumentation: Node.js runtime detected.')
  }
}

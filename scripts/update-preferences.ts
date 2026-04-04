// Manually trigger preference update for debugging
import * as RecommendationService from '../lib/services/recommendation.service'
import { logger } from '../lib/utils/logger'

const userId = parseInt(process.argv[2] || '3')

;(async () => {
  logger.info(`Updating preferences for user ${userId}...`)

  try {
    await RecommendationService.updateUserPreferences(userId)
    logger.info('Preferences update complete')
  } catch (error) {
    logger.error('Failed to update preferences', { error: error instanceof Error ? error.message : error })
    process.exit(1)
  }

  process.exit(0)
})()

// Manually trigger preference update for debugging
import * as RecommendationService from '../lib/services/recommendation.service'

const userId = parseInt(process.argv[2] || '3')

;(async () => {
  console.log(`Updating preferences for user ${userId}...`)

  await RecommendationService.updateUserPreferences(userId)

  console.log('Done!')
  process.exit(0)
})()

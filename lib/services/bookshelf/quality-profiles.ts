import { logger } from '@/lib/utils/logger'
import { db, qualityProfileConfigs } from '@/lib/db'
import { eq } from 'drizzle-orm'
import type { BookshelfConfig, QualityProfile } from '@/types/bookshelf.types'
import { apiGet } from './api'

/**
 * Get quality profiles from Bookshelf
 */
export async function getQualityProfiles(
  config: BookshelfConfig
): Promise<QualityProfile[]> {
  try {
    logger.debug('Fetching quality profiles', { url: '/api/v1/qualityprofile' })

    const profiles = await apiGet<QualityProfile[]>(config, '/api/v1/qualityprofile')

    logger.debug('Quality profiles fetched', { count: profiles.length })
    return profiles
  } catch (error) {
    logger.error('Failed to fetch quality profiles', {
      error: error instanceof Error ? error.message : String(error),
      url: '/api/v1/qualityprofile',
    })
    return []
  }
}

/**
 * Sync quality profiles from Bookshelf to local database
 * Creates/updates profile configs, maintains order for new profiles
 */
export async function syncQualityProfiles(config: BookshelfConfig): Promise<void> {
  try {
    const profiles = await getQualityProfiles(config)

    if (profiles.length === 0) {
      logger.warn('No quality profiles found to sync')
      return
    }

    // Get existing configs to determine next order index
    const existingConfigs = await db
      .select()
      .from(qualityProfileConfigs)
      .orderBy(qualityProfileConfigs.orderIndex)

    const existingIds = new Set(existingConfigs.map(c => c.profileId))
    let maxOrderIndex = existingConfigs.length > 0
      ? Math.max(...existingConfigs.map(c => c.orderIndex))
      : -1

    // Sync each profile
    for (const profile of profiles) {
      if (existingIds.has(profile.id)) {
        // Update existing profile name if changed
        await db
          .update(qualityProfileConfigs)
          .set({
            profileName: profile.name,
            updatedAt: new Date()
          })
          .where(eq(qualityProfileConfigs.profileId, profile.id))
      } else {
        // Insert new profile with next order index
        maxOrderIndex++
        await db.insert(qualityProfileConfigs).values({
          profileId: profile.id,
          profileName: profile.name,
          enabled: true,
          orderIndex: maxOrderIndex,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
    }

    logger.info('Quality profiles synced', { count: profiles.length })
  } catch (error) {
    logger.error('Failed to sync quality profiles', { error: error instanceof Error ? error.message : error })
    throw error
  }
}

/**
 * Get all quality profile configurations (for admin management)
 */
export async function getQualityProfileConfigs() {
  try {
    const configs = await db
      .select()
      .from(qualityProfileConfigs)
      .orderBy(qualityProfileConfigs.orderIndex)

    return configs
  } catch (error) {
    logger.error('Failed to get quality profile configs', { error: error instanceof Error ? error.message : error })
    return []
  }
}

/**
 * Get enabled quality profiles in order (for request form dropdown)
 */
export async function getEnabledQualityProfiles() {
  try {
    const configs = await db
      .select()
      .from(qualityProfileConfigs)
      .where(eq(qualityProfileConfigs.enabled, true))
      .orderBy(qualityProfileConfigs.orderIndex)

    return configs.map(c => ({
      id: c.profileId,
      name: c.profileName,
    }))
  } catch (error) {
    logger.error('Failed to get enabled quality profiles', { error: error instanceof Error ? error.message : error })
    return []
  }
}

/**
 * Update quality profile configuration
 */
export async function updateQualityProfileConfig(
  profileId: number,
  updates: { enabled?: boolean; orderIndex?: number }
) {
  try {
    await db
      .update(qualityProfileConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(qualityProfileConfigs.profileId, profileId))

    logger.info('Quality profile config updated', { profileId, updates })
  } catch (error) {
    logger.error('Failed to update quality profile config', { error: error instanceof Error ? error.message : error, profileId })
    throw error
  }
}

/**
 * Reorder quality profiles
 */
export async function reorderQualityProfiles(orderedProfileIds: number[]) {
  try {
    // Update each profile's orderIndex based on position in array
    for (let i = 0; i < orderedProfileIds.length; i++) {
      await db
        .update(qualityProfileConfigs)
        .set({ orderIndex: i, updatedAt: new Date() })
        .where(eq(qualityProfileConfigs.profileId, orderedProfileIds[i]))
    }

    logger.info('Quality profiles reordered', { count: orderedProfileIds.length })
  } catch (error) {
    logger.error('Failed to reorder quality profiles', { error: error instanceof Error ? error.message : error })
    throw error
  }
}

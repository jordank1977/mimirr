import { BookshelfConfig } from '@/types/bookshelf.types';
import { fetchWithTimeout } from './api';
import { logger } from '@/lib/utils/logger';

// Cache state
let libraryCache: any[] | null = null;
let libraryCacheTimestamp: number = 0;
let libraryFetchPromise: Promise<any[]> | null = null;

const CACHE_DURATION = 60 * 1000; // 60 seconds

/**
 * Fetch the entire Bookshelf library with caching.
 * Returns cached data if still valid, or fetches fresh data.
 */
export async function fetchLibraryWithCache(
  config: BookshelfConfig
): Promise<any[]> {
  const now = Date.now();

  // Check if we have a valid cache
  if (libraryCache && now - libraryCacheTimestamp < CACHE_DURATION) {
    logger.debug('Using cached Bookshelf library', {
      count: libraryCache.length,
      age: `${((now - libraryCacheTimestamp) / 1000).toFixed(1)}s`,
    });
    return libraryCache;
  }

  // Check if a fetch is already in progress
  if (libraryFetchPromise) {
    logger.debug('Waiting for in-progress Bookshelf library fetch');
    return libraryFetchPromise;
  }

  // Start a new fetch
  logger.info('Fetching fresh Bookshelf library');

  libraryFetchPromise = (async () => {
    try {
      const data = await fetchWithTimeout<any[]>(config, '/api/v1/book');

      // Update cache
      libraryCache = data;
      libraryCacheTimestamp = Date.now();
      logger.debug('Bookshelf library cache updated', { count: data.length });

      return data;
    } catch (error) {
      logger.error('Failed to fetch books from Bookshelf library', { error });
      return [];
    } finally {
      libraryFetchPromise = null;
    }
  })();

  return libraryFetchPromise;
}

/**
 * Invalidate the library cache (useful after adding/removing books)
 */
export function invalidateLibraryCache(): void {
  libraryCache = null;
  libraryCacheTimestamp = 0;
  logger.debug('Bookshelf library cache invalidated');
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus(): {
  isCached: boolean;
  age: number | null;
  count: number | null;
} {
  if (!libraryCache) {
    return { isCached: false, age: null, count: null };
  }

  return {
    isCached: true,
    age: Date.now() - libraryCacheTimestamp,
    count: libraryCache.length,
  };
}

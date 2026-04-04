import { db } from '../lib/db';
import { bookCache, requests } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/utils/logger';

async function main() {
  logger.info('Starting cleanup of "null" string images...');

  const cacheResult = await db.update(bookCache)
    .set({ coverImage: null })
    .where(eq(bookCache.coverImage, 'null'));

  logger.info('Cleaned bookCache.coverImage');

  // Requests does not have bookCoverImage in schema? Let's check requests table. Wait, requests has no bookCoverImage, it's joined from bookCache!
  // Oh, request-card takes `RequestWithBook` which includes `bookCoverImage` from the join!
  logger.info('Cleanup complete!');
  process.exit(0);
}
main().catch(err => {
  logger.error('Error during cleanup', { error: err instanceof Error ? err.message : err });
  process.exit(1);
});

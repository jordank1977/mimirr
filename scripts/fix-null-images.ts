import { db } from '../lib/db';
import { bookCache, requests } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('Starting cleanup of "null" string images...');

  const cacheResult = await db.update(bookCache)
    .set({ coverImage: null })
    .where(eq(bookCache.coverImage, 'null'));

  console.log('Cleaned bookCache.coverImage');

  // Requests does not have bookCoverImage in schema? Let's check requests table. Wait, requests has no bookCoverImage, it's joined from bookCache!
  // Oh, request-card takes `RequestWithBook` which includes `bookCoverImage` from the join!
  console.log('Cleanup complete!');
  process.exit(0);
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});

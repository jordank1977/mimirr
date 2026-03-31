import { db, requests, users, qualityProfileConfigs, settings, bookCache, libraryBooks, syncJobs } from '@/lib/db'
import { eq, and, sql, isNotNull, inArray, not } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'
import { BookshelfService } from './bookshelf.service'
import type { BookshelfConfig } from '@/types/bookshelf.types'

let lastReconciliationTime: number = 0
const RECONCILIATION_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class SyncService {
  /**
   * Ensure a System user exists for ghost imports
   */
  private static async getSystemUserId(): Promise<number> {
    const SYSTEM_USERNAME = 'system_sync'

    // Check if system user exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, SYSTEM_USERNAME))
      .limit(1)

    if (existing.length > 0) {
      return existing[0].id
    }

    // Create system user
    const newUser = await db.insert(users).values({
      username: SYSTEM_USERNAME,
      email: 'system@mimirr.local',
      passwordHash: 'SYSTEM_ACCOUNT_NO_LOGIN',
      role: 'admin',
      displayName: 'System',
    }).returning({ id: users.id })

    logger.info('Created system_sync user for ghost imports', { userId: newUser[0].id })
    return newUser[0].id
  }

  /**
   * Get fallback quality profile ID
   */
  private static async getFallbackQualityProfileId(): Promise<number> {
    const profiles = await db
      .select()
      .from(qualityProfileConfigs)
      .where(eq(qualityProfileConfigs.enabled, true))
      .limit(1)

    if (profiles.length > 0) {
      return profiles[0].profileId
    }

    // Absolute fallback
    return 1
  }

  /**
   * Main reconciliation engine (Baseline Sync)
   * Detached from standard polling. Triggered manually via API.
   * Implements the Hard Filter and Scorched Earth purge.
   */
  private static async normalizeLegacyStatuses(): Promise<void> {
    const statusMap: Record<string, string> = {
      'approved': 'processing',
      'Available': 'available',
      'Unreleased': 'unreleased',
      'Requested': 'requested',
      'Processing': 'processing',
      'Pending': 'pending',
      'Declined': 'declined',
      'Error': 'error'
    }

    try {
      let totalUpdated = 0

      for (const [legacyStatus, newStatus] of Object.entries(statusMap)) {
        const result = await db
          .update(requests)
          .set({ status: newStatus as any })
          .where(eq(requests.status, legacyStatus as any))

        totalUpdated += result.rowsAffected
      }

      if (totalUpdated > 0) {
        logger.info(`Normalized ${totalUpdated} legacy request statuses to strict lowercase`)
      }
    } catch (error) {
      logger.error('Failed to normalize legacy statuses:', error instanceof Error ? error.message : String(error))
    }
  }

  static async reconcileWithReadarr(config: BookshelfConfig, jobId?: number): Promise<{ added: number, orphaned: number, purged: number }> {
    logger.info('Starting Baseline Sync & Active State Reconciliation with Readarr')

    await this.normalizeLegacyStatuses()
    let addedCount = 0;
    let orphanedCount = 0;
    let purgedCount = 0;

    try {
      const { ReadarrService } = await import('@/lib/services/readarr.service');

      let shouldTriggerBookLore = false

      // 1. Fetch bulk library and authors from Readarr
      const readarrAuthors = await BookshelfService.getLibraryAuthors(config)
      const readarrLibrary = await ReadarrService.scanLocalLibrary()

      // Build author lookup map
      const authorMap = new Map<number, string>()
      for (const author of readarrAuthors) {
        if (author.id && author.authorName) {
          authorMap.set(author.id, author.authorName)
        }
      }

      // Build lookup maps for fast access
      const readarrBooksByBookshelfId = new Map<number, any>()
      const readarrForeignIds = new Set<string>()

      for (const book of readarrLibrary) {
        if (book.id) {
          readarrBooksByBookshelfId.set(book.id, book)
        }
        if (book.foreignBookId) {
          readarrForeignIds.add(String(book.foreignBookId))
        }
      }

      // Ensure system user exists
      const systemUserId = await this.getSystemUserId()

      // 2. Query Mimirr's requests table (only those tracking Readarr)
      const mimirrRequests = await db
        .select()
        .from(requests)

      const mimirrBookshelfIds = new Set<number>()
      const mimirrForeignIds = new Set<string>()

      const orphansToDelete: number[] = []
      const scorchForeignIds = new Set<string>()

      for (const req of mimirrRequests) {
        if (req.bookshelfId) {
          mimirrBookshelfIds.add(req.bookshelfId)

          // 3. Diff: Hard Purge (Orphans) and Scorched Earth Purge
          const readarrBook = readarrBooksByBookshelfId.get(req.bookshelfId)
          if (!readarrBook) {
            // Book is completely gone from Readarr
            orphansToDelete.push(req.id)
            logger.info('Identified orphaned request for hard purge', {
              requestId: req.id,
              bookshelfId: req.bookshelfId,
              bookId: req.bookId
            })
          } else if (req.userId === systemUserId) {
            // Scorched Earth Purge: Check if system_sync request should be purged
            const hasFiles = readarrBook.statistics?.bookFileCount > 0 || readarrBook.hasFile === true
            if (!hasFiles) {
              orphansToDelete.push(req.id)
              if (req.foreignBookId) scorchForeignIds.add(String(req.foreignBookId))
              if (req.bookId) scorchForeignIds.add(String(req.bookId))
              logger.info('Identified file-less ghost request for scorched earth purge', {
                requestId: req.id,
                bookshelfId: req.bookshelfId,
                bookId: req.bookId
              })
            }
          }

          // **NEW LOGIC: Update Mimirr status if Readarr book exists and is available but Mimirr is not**
          if (readarrBook) {
             const hasFiles = readarrBook.statistics?.bookFileCount > 0 || readarrBook.hasFile === true
             if (hasFiles && req.status !== 'available' && req.status !== 'Available') {
                try {
                   await db.update(requests)
                     .set({ status: 'available' as any, completedAt: new Date() })
                     .where(eq(requests.id, req.id))
                   logger.info(`Auto-corrected request ${req.id} status to available via background sync`, {
                     bookshelfId: req.bookshelfId,
                     foreignBookId: req.foreignBookId
                   })
                   shouldTriggerBookLore = true
                } catch (e) {
                   logger.error('Failed to auto-correct request status to available', { error: e, requestId: req.id })
                }
             }
          }
        }
        if (req.foreignBookId) {
            mimirrForeignIds.add(String(req.foreignBookId))
        } else if (req.bookId) {
             mimirrForeignIds.add(String(req.bookId))
        }
      }

      // Execute Hard Purge and Scorched Earth Purge (requests)
      if (orphansToDelete.length > 0) {
         // Batch delete in chunks if necessary, SQLite has limits but usually ok for small arrays
         await db.delete(requests).where(inArray(requests.id, orphansToDelete))
         orphanedCount = orphansToDelete.length;
         logger.info(`Completed Hard Purge: Deleted ${orphansToDelete.length} orphaned/file-less requests.`)
      }

      // Execute Scorched Earth Purge (metadata caches)
      if (scorchForeignIds.size > 0) {
        // Find which of these foreignIds are STILL being requested by REAL users
        const remainingRequests = await db
          .select({ bookId: requests.bookId, foreignBookId: requests.foreignBookId })
          .from(requests)
          .where(not(eq(requests.userId, systemUserId)))

        const activeForeignIds = new Set<string>()
        for (const req of remainingRequests) {
          if (req.foreignBookId) activeForeignIds.add(String(req.foreignBookId))
          if (req.bookId) activeForeignIds.add(String(req.bookId))
        }

        // Filter out IDs that are still actively requested
        const cacheIdsToPurge = Array.from(scorchForeignIds).filter(id => !activeForeignIds.has(id))

        if (cacheIdsToPurge.length > 0) {
          // Purge from bookCache
          await db.delete(bookCache).where(inArray(bookCache.id, cacheIdsToPurge))

          // Purge from libraryBooks
          await db.delete(libraryBooks).where(inArray(libraryBooks.foreignBookId, cacheIdsToPurge))
          purgedCount = cacheIdsToPurge.length;

          logger.info(`Completed Scorched Earth Cache Purge: Deleted metadata for ${cacheIdsToPurge.length} file-less ghost books.`)
        }
      }

      // 3.5 Populate libraryBooks table
      const uniqueLibraryBooks = new Map<string, any>()
      for (const book of readarrLibrary) {
        const foreignBookId = String(book.foreignBookId || book.id)
        const hasFiles = book.statistics?.bookFileCount > 0 || book.hasFile === true

        let status = 'unowned'; // Default fallback though it shouldn't hit this if monitored or has files

        if (hasFiles) {
          status = 'available';
        } else if (book.monitored) {
          const releaseDate = book.releaseDate ? new Date(book.releaseDate) : null;
          const now = new Date();

          if (releaseDate && releaseDate > now) {
            status = 'unreleased';
          } else {
            status = 'processing';
          }
        } else {
          // If neither has files nor monitored, skip inserting into uniqueLibraryBooks
          // unless it's a manual override, but rule says "Skip unmonitored books without files"
          // However, to keep legacy behavior of just skipping, we'll continue
          continue;
        }

        const existing = uniqueLibraryBooks.get(foreignBookId)
        // Deduplicate: Prioritize the duplicate that has files ('available')
        if (!existing || status === 'available' || status === 'Available') {
           uniqueLibraryBooks.set(foreignBookId, {
              foreignBookId,
              status,
              bookshelfId: book.id,
              title: book.title || '',
              authorName: authorMap.get(book.authorId) || '',
           })
        }
      }

      const libraryBooksToUpsert = Array.from(uniqueLibraryBooks.values())
      if (libraryBooksToUpsert.length > 0) {
        try {
          // Batch upsert library books
          const chunkSize = 100
          for (let i = 0; i < libraryBooksToUpsert.length; i += chunkSize) {
            const chunk = libraryBooksToUpsert.slice(i, i + chunkSize)
            await db.insert(libraryBooks).values(chunk).onConflictDoUpdate({
              target: libraryBooks.foreignBookId,
              set: {
                status: sql`excluded.status`,
                bookshelfId: sql`excluded.bookshelf_id`,
                title: sql`excluded.title`,
                authorName: sql`excluded.author_name`
              }
            })
          }
          logger.info(`Completed LibraryBooks Upsert: Synced ${libraryBooksToUpsert.length} books.`)
        } catch (e) {
          logger.error('Failed to upsert libraryBooks during Baseline Sync', { error: e })
        }
      }

      // 4. Diff: Ghost Import & Deep-Sync
      const ghostsToImport = []
      const fallbackQualityProfileId = await this.getFallbackQualityProfileId()

      const activityLog: string[] = []
      const logToActivity = async (msg: string) => {
        activityLog.push(msg)
        if (jobId) {
          try {
            await db.update(syncJobs)
              .set({ activityLog: JSON.stringify(activityLog) })
              .where(eq(syncJobs.id, jobId))
          } catch(e) {}
        }
      }

      for (const book of readarrLibrary) {
        const foreignId = String(book.foreignBookId || book.id)

        // Determine status
        const hasFiles = book.statistics?.bookFileCount > 0 || book.hasFile === true

        // "Relevant Only" Filter
        if (!hasFiles && book.monitored !== true) {
          continue;
        }

        let ghostStatus = 'unowned';
        if (hasFiles) {
          ghostStatus = 'available';
        } else if (book.monitored) {
          const releaseDate = book.releaseDate ? new Date(book.releaseDate) : null;
          const now = new Date();
          if (releaseDate && releaseDate > now) {
            ghostStatus = 'unreleased';
          } else {
            ghostStatus = 'processing';
          }
        }

        const titleStr = book.title;
        const authorStr = authorMap.get(book.authorId);

        if (!authorStr || !titleStr) {
          logger.warn('Skipping book due to missing discrete author or title in Readarr payload. Pending Manual Review.', {
            id: book.id,
            foreignBookId: book.foreignBookId,
            authorId: book.authorId,
            title: titleStr
          });
          continue;
        }

        // Deep-Sync Fetch
        await delay(50); // 50ms breather

        const deepBook = await BookshelfService.getBook(config, book.id);
        const editions = await BookshelfService.getBookEditions(config, book.id);
        const firstEdition = editions && editions.length > 0 ? editions[0] : null;

        if (!firstEdition) {
          const warnMsg = `[Partial Import] Missing edition for: ${titleStr}`;
          logger.warn(warnMsg);
          await logToActivity(warnMsg);
        }

        const description = firstEdition?.overview || deepBook?.overview || book.overview;
        if (!description) {
          const warnMsg = `[Partial Import] Missing description for: ${titleStr}`;
          logger.warn(warnMsg);
          await logToActivity(warnMsg);
        }

        // Mapping Deep-Sync data
        const deepSyncData = {
          id: foreignId,
          title: titleStr,
          author: authorStr,
          rating: deepBook?.ratings?.value ? String(deepBook.ratings.value) : null,
          pageCount: book.pageCount || null,
          publishedDate: book.releaseDate ? String(book.releaseDate) : null,
          publisher: firstEdition?.publisher || null,
          isbn13: firstEdition?.isbn13 || null,
          description: description || null,
          genres: deepBook?.genres ? JSON.stringify(deepBook.genres) : null,
          coverImage: book.images?.[0]?.remoteUrl || book.images?.[0]?.url || null,
        }

        // Insert into cache
        try {
          await db.insert(bookCache).values(deepSyncData).onConflictDoUpdate({
             target: bookCache.id,
             set: deepSyncData
          })
        } catch (e) {
           logger.warn('Failed to insert/update deep-sync cache entry', { foreignId, error: e })
        }

        // Check for Legacy Requests (Backfill Migration)
        const legacyRequest = mimirrRequests.find(req =>
          (req.foreignBookId === foreignId || req.bookId === foreignId) && !req.bookshelfId
        );

        if (legacyRequest) {
          // Backfill: Update the legacy request with the missing bookshelfId
          try {
            await db.update(requests)
              .set({
                bookshelfId: book.id,
                foreignBookId: foreignId,
                status: ghostStatus as any
              })
              .where(eq(requests.id, legacyRequest.id));

            logger.info('Backfilled legacy request with Readarr bookshelfId', {
              requestId: legacyRequest.id,
              bookshelfId: book.id,
              foreignBookId: foreignId
            });
            mimirrBookshelfIds.add(book.id); // Add it to avoid processing as ghost below if logic shifts
          } catch (e) {
            logger.warn('Failed to backfill legacy request', { requestId: legacyRequest.id, error: e });
          }
        } else if (!mimirrForeignIds.has(foreignId) && !mimirrBookshelfIds.has(book.id)) {
          // If it's not in Mimirr's tracking set AND not a legacy request
          const addedDate = book.added ? new Date(book.added) : new Date()

          // We're casting here because NewRequest expects a specific shape, but we are building it inline
          // Ensure we don't violate DB constraints
          const ghostRequest = {
            userId: systemUserId,
            bookId: foreignId, // Use foreignBookId as primary Mimirr ID for ghost imports
            status: ghostStatus as any, // Reflect actual status
            qualityProfileId: book.qualityProfileId || fallbackQualityProfileId,
            bookshelfId: book.id,
            requestedAt: addedDate,
            processedAt: addedDate,
            completedAt: addedDate,
            foreignBookId: foreignId,
            foreignAuthorId: String(book.authorId || ''),
            notes: null // Start clean, no notes unless needed
          }

          ghostsToImport.push(ghostRequest)
        }
      }

      // Execute Ghost Import
      if (ghostsToImport.length > 0) {
         // Break into chunks if necessary
         const chunkSize = 50
         for (let i = 0; i < ghostsToImport.length; i += chunkSize) {
            const chunk = ghostsToImport.slice(i, i + chunkSize)
            await db.insert(requests).values(chunk)
         }
         addedCount = ghostsToImport.length;
         logger.info(`Completed Ghost Import: Added ${ghostsToImport.length} synthetic requests.`)
         
         // If any ghosts were added and are available, we should trigger BookLore scan
         if (ghostsToImport.some(g => g.status === 'available' || g.status === 'Available')) {
           shouldTriggerBookLore = true
         }
      }

      // Hybrid Fallback: Trigger BookLore scan if any books transitioned to 'available'
      if (shouldTriggerBookLore) {
        import('@/lib/services/booklore.service').then(({ BookLoreService }) => {
          BookLoreService.getConfig().then(bookLoreConfig => {
            if (bookLoreConfig) {
              logger.info('Triggering automated BookLore scan from background sync (hybrid fallback)');
              BookLoreService.refreshLibrary(bookLoreConfig).catch(err => {
                logger.error('Automated BookLore scan failed during background sync', { error: err });
              });
            }
          }).catch(err => {
            logger.error('Failed to retrieve BookLore config for automated scan during background sync', { error: err });
          });
        });
      }

      logger.info('Baseline Sync & Active State Reconciliation complete')
      return { added: addedCount, orphaned: orphanedCount, purged: purgedCount };

    } catch (error) {
      logger.error('Failed to execute Active State Reconciliation', { error })
      throw error; // Rethrow so the API endpoint catches it
    }
  }
}

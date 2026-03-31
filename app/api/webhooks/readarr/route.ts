import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requests, users, settings } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import { NotificationService } from '@/lib/services/notification.service';
import { BookService } from '@/lib/services/book.service';
import { BookshelfService } from '@/lib/services/bookshelf.service';
import { BookLoreService } from '@/lib/services/booklore.service';

export async function POST(request: Request) {
  try {
    // 1. Authorization (OPSEC)
    const adminKey = request.headers.get('x-mimirr-admin-key');
    const secretKey = process.env.SYNC_AUDIT_SECRET;

    if (!secretKey || adminKey !== secretKey) {
      logger.warn('Unauthorized access attempt to webhook route');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const payload = await request.json();
    logger.debug('Received Readarr webhook', { eventType: payload.eventType });

    const eventType = payload.eventType; // 'Grab', 'Download' (Import)
    const book = payload.book;

    if (!book || (!book.id && !book.foreignBookId)) {
      logger.warn('Webhook payload missing book identifiers');
      return NextResponse.json({ error: 'Missing book identifiers' }, { status: 400 });
    }

    const bookshelfId = book.id;
    const foreignBookId = book.foreignBookId;

    // Find matching request in Mimirr
    const conditions = [];
    if (bookshelfId) conditions.push(eq(requests.bookshelfId, bookshelfId));
    if (foreignBookId) conditions.push(eq(requests.foreignBookId, String(foreignBookId)));

    const matchingRequests = await db
      .select()
      .from(requests)
      .where(or(...conditions))
      .limit(1);

    if (matchingRequests.length === 0) {
      logger.debug('No matching request found for webhook event', { bookshelfId, foreignBookId });
      return NextResponse.json({ message: 'No matching request found' });
    }

    const matchedRequest = matchingRequests[0];

    // Status mapping based on eventType
    if (eventType === 'Grab') {
      if (matchedRequest.status !== 'processing') {
        await db
          .update(requests)
          .set({ status: 'processing', processedAt: new Date(), notes: null })
          .where(eq(requests.id, matchedRequest.id));
        logger.info(`Webhook Grab event processed for request ${matchedRequest.id}`);
      }
    } else if (eventType === 'Download') {
      if (matchedRequest.status !== 'available') {
        await db
          .update(requests)
          .set({ status: 'available', completedAt: new Date(), notes: null })
          .where(eq(requests.id, matchedRequest.id));
        logger.info(`Webhook Download event processed for request ${matchedRequest.id}`);

        // Notify user
        try {
            const requestingUser = await db
              .select()
              .from(users)
              .where(eq(users.id, matchedRequest.userId))
              .limit(1);

            const username = requestingUser[0]?.username || 'Unknown User';

            // Use discrete fields from the webhook payload directly for notifications
            const titleStr = book.title || 'Unknown Title';

            let authorStr = 'Unknown Author';
            if (book.author?.authorName) {
              authorStr = book.author.authorName;
            } else if (book.authorId) {
              // Just-in-Time fetch of the author from the Readarr API
              try {
                const configSettings = await db.select().from(settings);
                const bookshelfUrlSetting = configSettings.find(s => s.key === 'bookshelf_url');
                const bookshelfApiKeySetting = configSettings.find(s => s.key === 'bookshelf_api_key');
                if (bookshelfUrlSetting?.value && bookshelfApiKeySetting?.value) {
                  const bookshelfConfig = {
                    url: bookshelfUrlSetting.value,
                    apiKey: bookshelfApiKeySetting.value
                  };
                  const authorResponse = await fetch(`${bookshelfConfig.url}/api/v1/author/${book.authorId}`, {
                    headers: { 'X-Api-Key': bookshelfConfig.apiKey }
                  });
                  if (authorResponse.ok) {
                    const authorData = await authorResponse.json();
                    if (authorData && authorData.authorName) {
                      authorStr = authorData.authorName;
                    }
                  }
                }
              } catch (e) {
                logger.error('Failed Just-in-Time fetch for author from Readarr', { error: e });
              }
            }

            const descriptionStr = book.overview || 'No description available';
            const coverImageStr = book.images?.[0]?.url || null;

            await NotificationService.sendNotification(
              matchedRequest.userId,
              'request_available',
              'Book Available',
              titleStr,
              authorStr,
              descriptionStr,
              coverImageStr,
              username,
              'Available',
              'Webhook Auto-Sync', // We could fetch quality profile name, but webhook is enough for now
              '/requests'
            );
        } catch (notifyError) {
            logger.error('Failed to send webhook completion notification', { error: notifyError });
        }

        // Trigger BookLore scan asynchronously
        BookLoreService.getConfig().then(config => {
          if (config) {
            logger.info('Triggering automated BookLore scan from Readarr webhook', { requestId: matchedRequest.id });
            BookLoreService.refreshLibrary(config).catch(err => {
              logger.error('Automated BookLore scan failed', { error: err });
            });
          }
        }).catch(err => {
          logger.error('Failed to retrieve BookLore config for automated scan', { error: err });
        });
      }
    } else {
        logger.debug('Ignoring unhandled webhook event type', { eventType });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    logger.error('Error processing Readarr webhook', { error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

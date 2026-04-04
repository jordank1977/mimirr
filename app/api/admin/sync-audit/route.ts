import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requests, settings } from '@/lib/db/schema';
import { inArray, isNotNull, eq } from 'drizzle-orm';
import { BookshelfService } from '@/lib/services/bookshelf.service';
import { logger } from '@/lib/utils/logger';
import { withLogging } from '@/lib/middleware/logging.middleware';
import { NextRequest } from 'next/server';

export const GET = withLogging(async function GET(request: NextRequest) {
  try {
    // 1. Authorization (OPSEC)
    const adminKey = request.headers.get('x-mimirr-admin-key');
    const secretKey = process.env.SYNC_AUDIT_SECRET;

    if (!secretKey || adminKey !== secretKey) {
      logger.warn('Unauthorized access attempt to sync-audit route');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Fetch configuration for BookshelfService
    const urlSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'bookshelf_url'))
      .limit(1);

    const apiKeySetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'bookshelf_api_key'))
      .limit(1);

    const bookshelfUrl = urlSetting[0]?.value;
    const bookshelfApiKey = apiKeySetting[0]?.value;

    if (!bookshelfUrl || !bookshelfApiKey) {
      return NextResponse.json({ error: 'Bookshelf configuration missing from database. Cannot perform sync audit.' }, { status: 500 });
    }

    // 2. Fetch the entire Readarr library
    const library = await BookshelfService.getLibraryBooks({ url: bookshelfUrl, apiKey: bookshelfApiKey });

    if (!library || !Array.isArray(library)) {
      return NextResponse.json(
        { error: 'Failed to fetch Readarr library payload' },
        { status: 500 }
      );
    }

    const totalReadarrBooksFetched = library.length;

    // Create in-memory Sets for fast lookup
    const readarrIds = new Set<number>();

    for (const book of library) {
      if (book.id) readarrIds.add(Number(book.id));
    }

    // 3. Query Mimirr's Database
    // Fetch requests in stateful tracking states
    const activeRequests = await db.query.requests.findMany({
      where: (requestsTable, { and, inArray, isNotNull }) =>
        and(
          inArray(requestsTable.status, ['approved', 'processing', 'available'] as any),
          isNotNull(requestsTable.bookshelfId)
        ),
    });

    const totalMimirrRecordsChecked = activeRequests.length;
    const orphanedRecords: any[] = [];

    // 4. Diffing Logic
    // Check requests table
    for (const req of activeRequests) {
      if (req.bookshelfId !== null && !readarrIds.has(Number(req.bookshelfId))) {
        orphanedRecords.push({
          sourceTable: 'requests',
          mimirrId: req.id,
          bookshelfId: req.bookshelfId,
          foreignBookId: req.foreignBookId,
          status: req.status,
          issue: 'bookshelfId not found in active Readarr library',
        });
      }
    }

    // 5. Build and return Report Structure
    const report = {
      auditTimestamp: new Date().toISOString(),
      metrics: {
        totalReadarrBooksFetched,
        totalMimirrRecordsChecked,
        totalOrphaned: orphanedRecords.length,
      },
      orphanedRecords,
    };

    return NextResponse.json(report);

  } catch (error) {
    logger.error('Error in sync-audit route', { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
});

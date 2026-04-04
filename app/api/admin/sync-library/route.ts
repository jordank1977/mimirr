import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { SyncService } from '@/lib/services/sync.service';
import { logger } from '@/lib/utils/logger';
import { withLogging } from '@/lib/middleware/logging.middleware';

export const dynamic = 'force-dynamic';
// Increase Vercel function timeout if deployed on Vercel, though this is primarily for self-hosted Docker
export const maxDuration = 300;

export const POST = withLogging(async function POST(request: NextRequest) {
  try {
    // 1. Authorization (OPSEC)
    const adminKey = request.headers.get('x-mimirr-admin-key');
    const secretKey = process.env.SYNC_AUDIT_SECRET;

    if (!secretKey || adminKey !== secretKey) {
      logger.warn('Unauthorized access attempt to sync-library route');
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
      return NextResponse.json(
        { error: 'Bookshelf configuration missing. Cannot perform Baseline Sync.' },
        { status: 500 }
      );
    }

    logger.debug('Triggering manual Baseline Sync');

    const bookshelfConfig = {
      url: bookshelfUrl,
      apiKey: bookshelfApiKey,
    };

    // Execute the detached heavy sync
    const report = await SyncService.reconcileWithReadarr(bookshelfConfig);

    return NextResponse.json({
      success: true,
      message: `Baseline Sync and Historical Reconciliation completed successfully. Added ${report.added} ghosts, removed ${report.orphaned} orphans, purged ${report.purged} metadata caches.`
    });

  } catch (error) {
    logger.error('Error executing Baseline Sync route', { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { error: 'Internal Server Error during Baseline Sync' },
      { status: 500 }
    );
  }
});

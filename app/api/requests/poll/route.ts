import { NextRequest, NextResponse } from 'next/server';
import { RequestService } from '@/lib/services/request.service';
import { logger } from '@/lib/utils/logger';
import { withLogging } from '@/lib/middleware/logging.middleware';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = withLogging(async function GET(request: NextRequest) {
  try {
    // 1. Authorization (OPSEC)
    const adminKey = request.headers.get('x-mimirr-admin-key');
    const secretKey = process.env.SYNC_AUDIT_SECRET;

    if (!secretKey || adminKey !== secretKey) {
      logger.warn('Unauthorized access attempt to target poll route');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    logger.debug('Starting Sniper Poller');
    const result = await RequestService.targetPollActiveRequests();

    return NextResponse.json({
      success: true,
      message: 'Sniper polling completed',
      ...result
    });

  } catch (error) {
    logger.error('Error executing sniper poller', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});

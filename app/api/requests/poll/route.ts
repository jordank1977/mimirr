import { NextRequest, NextResponse } from 'next/server';
import { RequestService } from '@/lib/services/request.service';
import { logger } from '@/lib/utils/logger';
import { withLogging } from '@/lib/middleware/logging.middleware';
import { requireAdmin, AuthError } from '@/lib/middleware/auth.middleware';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = withLogging(async function GET(request: NextRequest) {
  try {
    // 1. Authorization Check
    try {
      await requireAdmin(request)
    } catch (e) {
      if (e instanceof AuthError) {
        logger.warn('Unauthorized access attempt to target poll route')
        return new NextResponse('Unauthorized', { status: 401 })
      }
      throw e
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

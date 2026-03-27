import { NextResponse } from 'next/server';
import { RequestService } from '@/lib/services/request.service';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    // 1. Authorization (OPSEC)
    const adminKey = request.headers.get('x-mimirr-admin-key');
    const secretKey = process.env.SYNC_AUDIT_SECRET;

    if (!secretKey || adminKey !== secretKey) {
      logger.warn('Unauthorized access attempt to target poll route');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    logger.info('Starting Sniper Poller');
    const result = await RequestService.targetPollActiveRequests();

    return NextResponse.json({
      success: true,
      message: 'Sniper polling completed',
      ...result
    });

  } catch (error) {
    logger.error('Error executing sniper poller', { error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

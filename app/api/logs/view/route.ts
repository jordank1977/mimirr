import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import fs from 'fs'
import path from 'path'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/logs/view - Serve the raw log file
 */
export async function GET(request: NextRequest) {
  try {
    // Only admins should see the logs
    await requireAdmin(request)

    const logDir = process.env.NODE_ENV === 'production' 
      ? path.join(process.cwd(), 'config', 'logs')
      : path.join(process.cwd(), 'logs')
    const logPath = path.join(logDir, 'mimirr.log')

    if (!fs.existsSync(logPath)) {
      return new NextResponse('Log file not found.', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    const logContent = fs.readFileSync(logPath, 'utf8')

    return new NextResponse(logContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('Failed to serve log file', { error })
    return new NextResponse('Error retrieving log file.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

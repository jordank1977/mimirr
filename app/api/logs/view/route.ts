import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import fs from 'fs'
import path from 'path'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/logs/view - Serve the parsed log file
 * Now handles NDJSON format from Pino and formats it back to plain text for the UI.
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
    const lines = logContent.split('\n').filter(line => line.trim())
    
    const formattedLogs = lines.map(line => {
      try {
        const log = JSON.parse(line)
        const timestamp = new Date(log.time).toISOString()
        const level = getLevelName(log.level)
        const requestId = log.reqId ? ` [${log.reqId}]` : ''
        const message = log.msg || ''
        
        // Extract data that isn't standard Pino fields
        const { time, level: l, msg, reqId, hostname, pid, ...data } = log
        const dataStr = Object.keys(data).length > 0 ? ` | ${JSON.stringify(data)}` : ''
        
        return `[${timestamp}] [${level.toUpperCase()}]${requestId} ${message}${dataStr}`
      } catch (e) {
        // If it's not JSON (e.g. old logs), return as is
        return line
      }
    }).join('\n')

    return new NextResponse(formattedLogs, {
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

function getLevelName(level: number): string {
  if (level <= 10) return 'trace'
  if (level <= 20) return 'debug'
  if (level <= 30) return 'info'
  if (level <= 40) return 'warn'
  if (level <= 50) return 'error'
  return 'fatal'
}

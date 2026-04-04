import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import { withLogging } from '@/lib/middleware/logging.middleware'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { logger, logDir } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/logs/view - Serve the parsed log file
 * Now handles NDJSON format from Pino and formats it back to plain text for the UI.
 * Supports ?file= parameter to view specific log files.
 */
async function getHandler(request: NextRequest) {
  try {
    // Only admins should see the logs
    await requireAdmin(request)

    // Get the requested filename from query parameter
    const { searchParams } = new URL(request.url)
    let filename = searchParams.get('file')
    
    // If no file parameter provided, default to the most recent standard log file
    if (!filename) {
      try {
        const files = fs.readdirSync(logDir)
        const logFiles = files.filter(f => f.startsWith('mimirr') && !f.includes('debug') && f.includes('log'))

        if (logFiles.length > 0) {
          // Find the most recently modified standard log file
          let mostRecentFile = logFiles[0]
          let mostRecentTime = fs.statSync(path.join(logDir, mostRecentFile)).mtimeMs

          for (let i = 1; i < logFiles.length; i++) {
            const time = fs.statSync(path.join(logDir, logFiles[i])).mtimeMs
            if (time > mostRecentTime) {
              mostRecentTime = time
              mostRecentFile = logFiles[i]
            }
          }
          filename = mostRecentFile
        } else {
          filename = 'mimirr.log' // fallback
        }
      } catch (e) {
        filename = 'mimirr.log' // fallback if directory read fails
      }
    }

    // Security check: validate filename
    // 1. Must start with 'mimirr' and contain 'log' or 'debug'
    // 2. Must not contain path traversal characters
    if (!(filename.startsWith('mimirr') && (filename.includes('log') || filename.includes('debug'))) ||
        filename.includes('..') || 
        filename.includes('/') || 
        filename.includes('\\')) {
      return new NextResponse('Invalid log file requested.', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    const logPath = path.join(logDir, filename)

    if (!fs.existsSync(logPath)) {
      return new NextResponse('Log file not found.', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    // Process file asynchronously line-by-line to prevent event loop blocking on large files
    const formattedLogs: string[] = []
    const fileStream = fs.createReadStream(logPath, 'utf8')
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    })

    for await (const line of rl) {
      if (!line.trim()) continue
      try {
        const log = JSON.parse(line)
        const timestamp = new Date(log.time).toISOString()
        const level = getLevelName(log.level)
        const requestId = log.reqId ? ` [${log.reqId}]` : ''
        const message = log.msg || ''
        
        // Extract data that isn't standard Pino fields
        const { time, level: l, msg, reqId, hostname, pid, ...data } = log
        const dataStr = Object.keys(data).length > 0 ? ` | ${JSON.stringify(data)}` : ''
        
        formattedLogs.push(`[${timestamp}] [${level.toUpperCase()}]${requestId} ${message}${dataStr}`)
      } catch (e) {
        // If it's not JSON (e.g. old logs), return as is
        formattedLogs.push(line)
      }
    }

    return new NextResponse(formattedLogs.join('\n'), {
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

    logger.error('Failed to serve log file', { error: error instanceof Error ? error.message : error })
    return new NextResponse('Error retrieving log file.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

export const GET = withLogging(getHandler)

function getLevelName(level: number): string {
  if (level <= 10) return 'trace'
  if (level <= 20) return 'debug'
  if (level <= 30) return 'info'
  if (level <= 40) return 'warn'
  if (level <= 50) return 'error'
  return 'fatal'
}

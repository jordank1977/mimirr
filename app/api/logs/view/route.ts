import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError, AuthError } from '@/lib/middleware/auth.middleware'
import { withLogging } from '@/lib/middleware/logging.middleware'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import readline from 'readline'
import { logger, logDir } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

const LEVEL_MAP: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  warning: 40,
  error: 50,
  fatal: 60,
}

/**
 * GET /api/logs/view - Serve the parsed log file
 * Supports ?file=, ?tail=, ?level=, and ?search= query parameters.
 */
async function getHandler(request: NextRequest) {
  try {
    // Only admins should see the logs
    await requireAdmin(request)

    // Get query parameters
    const { searchParams } = new URL(request.url)
    let filename = searchParams.get('file')
    
    // If no file parameter provided, default to the most recent standard log file
    if (!filename) {
      try {
        const files = await fsPromises.readdir(logDir)
        const logFiles = files.filter(f => f.startsWith('mimirr') && !f.includes('debug') && f.includes('log'))

        if (logFiles.length > 0) {
          // Find the most recently modified standard log file
          let mostRecentFile = logFiles[0]
          let mostRecentTime = 0
          try {
            mostRecentTime = (await fsPromises.stat(path.join(logDir, mostRecentFile))).mtimeMs
          } catch {
            // Ignore stat failures on unlinked files
          }

          for (let i = 1; i < logFiles.length; i++) {
            try {
              const time = (await fsPromises.stat(path.join(logDir, logFiles[i]))).mtimeMs
              if (time > mostRecentTime) {
                mostRecentTime = time
                mostRecentFile = logFiles[i]
              }
            } catch {
              // Ignore stat failures
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
    if (!filename ||
        !(filename.startsWith('mimirr') && (filename.includes('log') || filename.includes('debug'))) ||
        filename.includes('..') || 
        filename.includes('/') || 
        filename.includes('\\')) {
      return new NextResponse('Invalid log file requested.', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    const logPath = path.join(logDir, filename)

    try {
      const stat = await fsPromises.stat(logPath)
      if (!stat.isFile()) {
        return new NextResponse('Log file not found.', {
          status: 404,
          headers: { 'Content-Type': 'text/plain' },
        })
      }
    } catch {
      return new NextResponse('Log file not found.', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    // Parse bounded tail parameter (default: 500, max: 5000, 0: unbounded)
    const tailParam = searchParams.get('tail')
    let tail = 500
    if (tailParam !== null) {
      const parsedTail = parseInt(tailParam, 10)
      if (isNaN(parsedTail) || parsedTail < 0) {
        tail = 500
      } else if (parsedTail > 5000) {
        tail = 5000
      } else {
        tail = parsedTail
      }
    }

    // Parse minimum level filter
    const levelParam = searchParams.get('level')?.trim().toLowerCase()
    const minLevel = levelParam && LEVEL_MAP[levelParam] ? LEVEL_MAP[levelParam] : 0

    // Parse substring search filter
    const searchLower = searchParams.get('search')?.trim().toLowerCase() || ''

    // Circular ring buffer for O(1) bounded memory storage
    const ring: string[] = tail > 0 ? new Array<string>(tail) : []
    let writeIdx = 0
    let count = 0
    const formattedLogs: string[] = []

    const fileStream = fs.createReadStream(logPath, 'utf8')
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    })

    try {
      for await (const line of rl) {
        if (!line.trim()) continue
        try {
          const log = JSON.parse(line)

          // 1. Level filter check before stringification or date formatting
          if (minLevel > 0 && typeof log.level === 'number' && log.level < minLevel) {
            continue
          }

          const timestamp = new Date(log.time).toISOString()
          const level = getLevelName(log.level)
          const requestId = log.reqId ? ` [${log.reqId}]` : ''
          const message = log.msg || ''
          
          // Extract data that isn't standard Pino fields
          const { time, level: l, msg, reqId, hostname, pid, ...data } = log
          const dataStr = Object.keys(data).length > 0 ? ` | ${JSON.stringify(data)}` : ''
          
          const formattedLine = `[${timestamp}] [${level.toUpperCase()}]${requestId} ${message}${dataStr}`

          // 2. Substring search filter check
          if (searchLower && !formattedLine.toLowerCase().includes(searchLower)) {
            continue
          }

          // 3. Store in circular ring buffer or unbounded array
          if (tail > 0) {
            ring[writeIdx] = formattedLine
            writeIdx = (writeIdx + 1) % tail
            if (count < tail) count++
          } else {
            formattedLogs.push(formattedLine)
          }
        } catch (e) {
          // If it's not JSON (e.g. legacy plain text logs)
          if (minLevel > 0) {
            continue
          }
          if (searchLower && !line.toLowerCase().includes(searchLower)) {
            continue
          }
          if (tail > 0) {
            ring[writeIdx] = line
            writeIdx = (writeIdx + 1) % tail
            if (count < tail) count++
          } else {
            formattedLogs.push(line)
          }
        }
      }
    } finally {
      rl.close()
      fileStream.destroy()
    }

    // Reconstruct lines in correct chronological order
    const outputLines =
      tail > 0
        ? count < tail
          ? ring.slice(0, count)
          : [...ring.slice(writeIdx), ...ring.slice(0, writeIdx)]
        : formattedLogs

    return new NextResponse(outputLines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
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

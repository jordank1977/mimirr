import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError, AuthError } from '@/lib/middleware/auth.middleware'
import { logger, logDir } from '@/lib/utils/logger'
import fs from 'fs/promises'
import path from 'path'
import { withLogging } from '@/lib/middleware/logging.middleware'

export const GET = withLogging(async function GET(request: NextRequest) {
  try {
    // Ensure only admins can access logs
    await requireAdmin(request)

    // Read directory contents
    let files: string[]
    try {
      files = await fs.readdir(logDir)
    } catch (error) {
      // If directory doesn't exist, return empty array
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return NextResponse.json([])
      }
      throw error
    }

    // Filter and process log files
    const logFilesRaw = await Promise.all(
      files
        .filter(file => file.startsWith('mimirr') && (file.includes('log') || file.includes('debug')))
        .map(async (file) => {
          try {
            const filePath = path.join(logDir, file)
            const stats = await fs.stat(filePath)
            if (!stats.isFile()) return null
            
            return {
              name: file,
              size: stats.size,
              lastModified: stats.mtime.toISOString()
            }
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
              return null
            }
            throw err
          }
        })
    )

    const logFiles = logFilesRaw.filter((file): file is NonNullable<typeof file> => file !== null)

    // Sort by last modified (newest first)
    logFiles.sort((a, b) => 
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    )

    return NextResponse.json(logFiles)
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error)
    }

    logger.error('Error fetching log files:', { error: error instanceof Error ? error.message : error })
    return NextResponse.json(
      { error: 'Failed to fetch log files' },
      { status: 500 }
    )
  }
});
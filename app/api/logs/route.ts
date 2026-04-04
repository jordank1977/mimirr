import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/middleware/auth.middleware'
import { logger, logDir } from '@/lib/utils/logger'
import fs from 'fs/promises'
import path from 'path'
import { withLogging } from '@/lib/middleware/logging.middleware'

export const GET = withLogging(async function GET(request: NextRequest) {
  try {
    // Ensure only admins can access logs
    await requireAdmin(request)

    // Read directory contents
    let files
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
    const logFiles = await Promise.all(
      files
        .filter(file => file.startsWith('mimirr') && (file.includes('log') || file.includes('debug')))
        .map(async (file) => {
          const filePath = path.join(logDir, file)
          const stats = await fs.stat(filePath)
          
          return {
            name: file,
            size: stats.size,
            lastModified: stats.mtime.toISOString()
          }
        })
    )

    // Sort by last modified (newest first)
    logFiles.sort((a, b) => 
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    )

    return NextResponse.json(logFiles)
  } catch (error) {
    logger.error('Error fetching log files:', { error: error instanceof Error ? error.message : error })
    
    // Handle authentication errors
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { error: error.message },
        { status: (error as any).statusCode || 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch log files' },
      { status: 500 }
    )
  }
});
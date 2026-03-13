import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/middleware/auth.middleware'
import fs from 'fs/promises'
import path from 'path'

export async function GET(request: NextRequest) {
  try {
    // Ensure only admins can access logs
    await requireAdmin(request)

    // Determine log directory based on environment
    const logDir = process.env.NODE_ENV === 'production' 
      ? path.join(process.cwd(), 'config', 'logs')
      : path.join(process.cwd(), 'logs')

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
        .filter(file => file.startsWith('mimirr.log'))
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
    console.error('Error fetching log files:', error)
    
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
}
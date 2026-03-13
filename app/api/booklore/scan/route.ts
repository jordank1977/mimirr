import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { BookLoreService } from '@/lib/services/booklore.service'
import { logger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    await requireAuth(request)

    // Get BookLore configuration
    const config = await BookLoreService.getConfig()
    
    if (!config) {
      return NextResponse.json(
        { error: 'BookLore configuration not found. Please configure BookLore settings first.' },
        { status: 400 }
      )
    }

    // Trigger library refresh/scan
    const result = await BookLoreService.refreshLibrary(config)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to scan BookLore library' },
        { status: 500 }
      )
    }

    // Return 204 No Content on success
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    logger.error('BookLore scan error:', { error })
    return NextResponse.json(
      { error: 'Internal server error during BookLore scan' },
      { status: 500 }
    )
  }
}

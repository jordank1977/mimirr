import { NextRequest, NextResponse } from 'next/server'
import { withLogging } from '@/lib/middleware/logging.middleware'
import { requireAdmin, handleAuthError } from '@/lib/middleware/auth.middleware'
import { bookloreSettingsSchema } from '@/lib/utils/validation'
import { BookLoreService } from '@/lib/services/booklore.service'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/settings/booklore/test - Test BookLore connection without saving
 */
async function postHandler(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = await request.json()

    // Validate input
    const validatedData = bookloreSettingsSchema.parse(body)

    logger.info('Testing BookLore connection', {
      url: validatedData.url,
      username: validatedData.username,
      libraryId: validatedData.libraryId
    })

    // Test connection
    const isConnected = await BookLoreService.testConnection({
      url: validatedData.url,
      username: validatedData.username,
      password: validatedData.password,
      libraryId: validatedData.libraryId,
    })

    if (!isConnected) {
      logger.error('BookLore connection test failed', {
        url: validatedData.url,
        libraryId: validatedData.libraryId
      })
      return NextResponse.json(
        { error: 'Failed to connect to BookLore. Please check your URL, credentials, and library ID.' },
        { status: 400 }
      )
    }

    // Get library status to show in preview
    let libraryStatus: any = null
    try {
      const statusResult = await BookLoreService.getLibraryStatus({
        url: validatedData.url,
        username: validatedData.username,
        password: validatedData.password,
        libraryId: validatedData.libraryId,
      })

      if (statusResult.success) {
        libraryStatus = statusResult.status
      }
    } catch (error) {
      logger.error('Failed to fetch library status during test', { error })
      // Don't fail the test if status fetch fails
    }

    logger.info('BookLore connection test successful', {
      url: validatedData.url,
      libraryId: validatedData.libraryId,
      hasLibraryStatus: !!libraryStatus
    })

    return NextResponse.json({
      success: true,
      message: 'Connection successful',
      libraryStatus,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return handleAuthError(error)
    }

    if (error instanceof Error) {
      logger.error('Test BookLore connection error', { error: error.message })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.error('Unexpected test connection error', { error })
    return NextResponse.json(
      { error: 'Connection test failed' },
      { status: 500 }
    )
  }
}

export const POST = withLogging(postHandler)
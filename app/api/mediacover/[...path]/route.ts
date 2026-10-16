import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/middleware/auth.middleware'
import { db, settings } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Standard Mimirr auth wrapper (Rule 4)
    // Allow local image optimizer, LAN requests, or authenticated users
    try {
      await requireAuth(request)
    } catch (authError) {
      const host = request.headers.get('host') || ''
      const accept = request.headers.get('accept') || ''
      const secFetchDest = request.headers.get('sec-fetch-dest') || ''

      const isInternalHost =
        host.includes('localhost') ||
        host.includes('127.0.0.1') ||
        host.includes('::1') ||
        host.startsWith('192.168.') ||
        host.startsWith('10.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)

      const isImageRequest = accept.includes('image/') || secFetchDest === 'image'

      if (!isInternalHost && !isImageRequest) {
        return handleAuthError(authError)
      }
    }

    const { path } = await params
    if (!path || path.length === 0) {
      return new NextResponse('Media cover path is required', { status: 400 })
    }

    const joinedPath = path.join('/')

    // Get Bookshelf settings
    const urlSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'bookshelf_url'))
      .limit(1)

    const apiKeySetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'bookshelf_api_key'))
      .limit(1)

    const bookshelfUrl = urlSetting[0]?.value?.replace(/\/$/, '')
    const apiKey = apiKeySetting[0]?.value

    if (!bookshelfUrl || !apiKey) {
      return new NextResponse('Bookshelf is not configured', { status: 503 })
    }

    // Determine target URL path:
    // Readarr has two image prefixes:
    // 1. /MediaCover/Books/... and /MediaCover/Authors/... (Library items)
    // 2. /MediaCoverProxy/... (External search items proxied by Readarr)
    let targetRelativePath: string
    if (joinedPath.startsWith('MediaCoverProxy/') || joinedPath.startsWith('MediaCover/')) {
      targetRelativePath = joinedPath
    } else {
      targetRelativePath = `MediaCover/${joinedPath}`
    }

    // Preserve existing query parameters
    const searchParams = new URLSearchParams(request.nextUrl.searchParams)
    const isbn = searchParams.get('isbn')
    searchParams.delete('isbn') // Do not forward Mimirr internal fallback param to Bookshelf

    // Forward apikey if not already present
    if (!searchParams.has('apikey')) {
      searchParams.set('apikey', apiKey)
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
    const targetUrl = `${bookshelfUrl}/${targetRelativePath}${query}`
    // Log-safe URL: omits the query string so the forwarded apikey is never written to logs
    const safeTargetUrl = `${bookshelfUrl}/${targetRelativePath}`

    // Network resilience: AbortController with ~8-second timeout (Rule 4)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'X-Api-Key': apiKey,
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        if (isbn) {
          try {
            const openLibraryUrl = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`
            const olResponse = await fetch(openLibraryUrl, {
              headers: { 'User-Agent': 'Mimirr/1.0 (Book Cover Proxy)' },
              signal: controller.signal,
            })
            const olContentType = olResponse.headers.get('content-type') || ''
            if (olResponse.ok && olContentType.toLowerCase().startsWith('image/')) {
              const olBuffer = Buffer.from(await olResponse.arrayBuffer())
              return new NextResponse(olBuffer, {
                status: 200,
                headers: {
                  'Content-Type': olContentType,
                  'Cache-Control': 'public, max-age=604800, stale-while-revalidate=2592000',
                },
              })
            }
          } catch {
            // Fall through to 404
          }
        }
        return new NextResponse(null, { status: response.status })
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg'

      // Validate that Bookshelf returned actual image data, not HTML SPA fallback
      if (!contentType.toLowerCase().startsWith('image/')) {
        logger.debug('Bookshelf returned non-image response for MediaCover', {
          targetUrl: safeTargetUrl,
          contentType,
        })

        if (isbn) {
          try {
            const openLibraryUrl = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`
            const olResponse = await fetch(openLibraryUrl, {
              headers: { 'User-Agent': 'Mimirr/1.0 (Book Cover Proxy)' },
              signal: controller.signal,
            })
            const olContentType = olResponse.headers.get('content-type') || ''
            if (olResponse.ok && olContentType.toLowerCase().startsWith('image/')) {
              const olBuffer = Buffer.from(await olResponse.arrayBuffer())
              return new NextResponse(olBuffer, {
                status: 200,
                headers: {
                  'Content-Type': olContentType,
                  'Cache-Control': 'public, max-age=604800, stale-while-revalidate=2592000',
                },
              })
            }
          } catch {
            // Fall through to 404
          }
        }

        return new NextResponse(null, { status: 404 })
      }

      const imageBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(imageBuffer)

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      })
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        logger.warn('Bookshelf MediaCover proxy request timed out', { targetUrl: safeTargetUrl })
        return new NextResponse('Gateway Timeout', { status: 504 })
      }
      throw fetchError
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    logger.error('Failed to proxy MediaCover from Bookshelf', {
      error: error instanceof Error ? error.message : error,
    })
    return new NextResponse('Failed to load media cover', { status: 500 })
  }
}

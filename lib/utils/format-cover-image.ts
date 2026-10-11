/**
 * Helper to normalize and format book cover image URLs.
 * Handles:
 * - Empty / 'null' strings -> undefined
 * - Absolute remote URLs (http:// or https://) -> preserved
 * - Readarr local MediaCover URLs -> routed to Mimirr /api/mediacover proxy
 */
export function formatCoverImageUrl(url: string | null | undefined): string | undefined {
  if (!url || typeof url !== 'string') return undefined

  const trimmed = url.trim()
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return undefined

  // Remote absolute URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  // Already pointing to our local proxy
  if (trimmed.startsWith('/api/mediacover/')) {
    return trimmed
  }

  // Readarr /MediaCover/... path
  if (trimmed.startsWith('/MediaCover/')) {
    return `/api/mediacover/${trimmed.replace(/^\/MediaCover\//, '')}`
  }

  // Readarr /api/v1/mediacover/... path
  if (trimmed.startsWith('/api/v1/mediacover/')) {
    return `/api/mediacover/${trimmed.replace(/^\/api\/v1\/mediacover\//, '')}`
  }

  // Any other relative path from Bookshelf
  if (trimmed.startsWith('/')) {
    return `/api/mediacover/${trimmed.replace(/^\//, '')}`
  }

  return trimmed
}

'use server'

import { ReadarrService, TargetBookShape, MimirrState } from '@/lib/services/readarr.service'
import { db, libraryBooks, requests } from '@/lib/db'
import { inArray } from 'drizzle-orm'

export type { TargetBookShape, MimirrState }

// Step 1: Search Readarr (Initial Book List)
export async function searchReadarrBooks(query: string): Promise<TargetBookShape[]> {
  const results = await ReadarrService.searchBooks(query)

  if (!results || results.length === 0) {
    return results
  }

  // 1. Extract all IDs from the search results
  const foreignIds = results
    .map(b => b.foreignBookId)
    .filter((id): id is string => id !== undefined && id !== null)

  if (foreignIds.length === 0) {
    return results.map(b => ({ ...b, mimirrState: 'Unowned' as MimirrState }))
  }

  // 2. Query both tables using the IN clause (Batch Processing)
  const ownedBooks = await db
    .select()
    .from(libraryBooks)
    .where(inArray(libraryBooks.foreignBookId, foreignIds))

  const requestedBooks = await db
    .select()
    .from(requests)
    .where(inArray(requests.foreignBookId, foreignIds))

  // 3. Inject the state back into the results array before sending to the frontend.
  return results.map(book => {
    if (!book.foreignBookId) {
      return { ...book, mimirrState: 'Unowned' as MimirrState }
    }

    const owned = ownedBooks.find(ob => ob.foreignBookId === book.foreignBookId)
    if (owned) {
      if (owned.status === 'Available' || owned.status === 'available') {
        return { ...book, mimirrState: 'Available' as MimirrState }
      } else if (owned.status === 'Unreleased' || owned.status === 'unreleased') {
        return { ...book, mimirrState: 'Unreleased' as MimirrState }
      } else {
        return { ...book, mimirrState: 'Processing' as MimirrState }
      }
    }

    const requested = requestedBooks.find(rb => rb.foreignBookId === book.foreignBookId)
    if (requested) {
      if (requested.status === 'pending') {
        return { ...book, mimirrState: 'Requested' as MimirrState }
      }
      if (['approved', 'processing', 'Processing'].includes(requested.status)) {
        return { ...book, mimirrState: 'Processing' as MimirrState }
      }
      if (['unreleased', 'Unreleased'].includes(requested.status)) {
        return { ...book, mimirrState: 'Unreleased' as MimirrState }
      }
      // 'available' is effectively 'Available' if requested and picked up, or we can fallback to unowned for declined
      if (['available', 'Available'].includes(requested.status)) {
        return { ...book, mimirrState: 'Available' as MimirrState }
      }
    }

    return { ...book, mimirrState: 'Unowned' as MimirrState }
  })
}

// Step 2: Fetch Details (Editions)
export async function fetchReadarrBookDetails(book: any): Promise<TargetBookShape> {
  // We're moving to a single-pass model for external discovery so getBookDetails
  // is no longer necessary for discovery. We just return the book that was
  // already mapped to TargetBookShape during search.
  // However, we still support local mapping via getBookDetails if needed.
  return book;
}

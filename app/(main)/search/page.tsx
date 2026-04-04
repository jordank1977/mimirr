'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BookGrid } from '@/components/book/book-grid'
import type { Book } from '@/types/bookinfo'
import { logToClient } from '@/lib/utils/client-logger'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [books, setBooks] = useState<Book[]>([])
  const [searchState, setSearchState] = useState<'idle' | 'searching' | 'loading-details' | 'success' | 'error'>('idle')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) return

    setSearchState('searching')
    setBooks([])

    try {
      const { searchReadarrBooks, fetchReadarrBookDetails } = await import('@/app/actions/search')

      // Step 1: Initial Search
      const initialBooks = await searchReadarrBooks(query)

      if (!initialBooks || initialBooks.length === 0) {
        setSearchState('success')
        return
      }

      // Step 2: Fetch Details
      setSearchState('loading-details')

      // We will map these concurrently, but handle failures so that one missing edition doesn't break the whole list.
      const detailedBooks = await Promise.all(
        initialBooks.map(async (book: any) => {
          return await fetchReadarrBookDetails(book)
        })
      )

      setBooks(detailedBooks as any)
      setSearchState('success')
    } catch (error) {
      logToClient('error', 'Search error', { error: error instanceof Error ? error.message : error })
      setSearchState('error')
    }
  }

  const isLoading = searchState === 'searching' || searchState === 'loading-details'
  const isComplete = searchState === 'success'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Search Books
        </h1>
        <p className="text-foreground-muted">
          Search for books by title or author
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-4">
        <Input
          type="text"
          placeholder="Enter book title or author..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading || !query.trim()}>
          {isLoading ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {searchState === 'searching' && (
        <div className="text-center py-12">
          <p className="text-foreground-muted">Searching Readarr...</p>
        </div>
      )}

      {searchState === 'loading-details' && (
        <div className="text-center py-12">
          <p className="text-foreground-muted animate-pulse">Pulling in publishers and descriptions...</p>
        </div>
      )}

      {searchState === 'error' && (
        <div className="text-center py-12">
          <p className="text-red-500">Something went wrong while searching. Please try again.</p>
        </div>
      )}

      {isComplete && (
        <div>
          <p className="text-sm text-foreground-muted mb-4">
            Found {books.length} {books.length === 1 ? 'book' : 'books'}
          </p>
          <BookGrid
            books={books}
            emptyMessage="No books found. Try a different search term."
          />
        </div>
      )}

      {searchState === 'idle' && (
        <div className="text-center py-12">
          <p className="text-foreground-muted">
            Enter a search term to find books
          </p>
        </div>
      )}
    </div>
  )
}

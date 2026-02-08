'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BookGrid } from '@/components/book/book-grid'
import type { Book } from '@/types/bookinfo'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) return

    setLoading(true)
    setSearched(true)

    try {
      const response = await fetch(
        `/api/books/search?q=${encodeURIComponent(query)}`
      )

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setBooks(data.books)
    } catch (error) {
      console.error('Search error:', error)
      setBooks([])
    } finally {
      setLoading(false)
    }
  }

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
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {loading && (
        <div className="text-center py-12">
          <p className="text-foreground-muted">Searching...</p>
        </div>
      )}

      {!loading && searched && (
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

      {!loading && !searched && (
        <div className="text-center py-12">
          <p className="text-foreground-muted">
            Enter a search term to find books
          </p>
        </div>
      )}
    </div>
  )
}

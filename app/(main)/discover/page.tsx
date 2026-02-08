'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookGrid } from '@/components/book/book-grid'
import { AuthorGrid } from '@/components/author/author-grid'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Book, Author } from '@/types/bookinfo'

export default function DiscoverPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [personalizedBooks, setPersonalizedBooks] = useState<{
    hasRequests: boolean
    popularForYou: Book[]
    newForYou: Book[]
    authorsForYou: Author[]
  } | null>(null)
  const [searchResults, setSearchResults] = useState<Book[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Sync search state with URL params on mount and when params change
  useEffect(() => {
    const query = searchParams.get('q')
    if (query) {
      setSearchQuery(query)
      setHasSearched(true)
      // Perform search
      const performSearch = async () => {
        setSearching(true)
        try {
          const response = await fetch(
            `/api/books/search?q=${encodeURIComponent(query)}`
          )
          if (!response.ok) {
            throw new Error('Search failed')
          }
          const data = await response.json()
          setSearchResults(data.books || [])
        } catch (error) {
          console.error('Search error:', error)
          setSearchResults([])
        } finally {
          setSearching(false)
        }
      }
      performSearch()
    } else {
      // Clear search state when no query param
      setSearchQuery('')
      setSearchResults([])
      setHasSearched(false)
    }
  }, [searchParams])

  useEffect(() => {
    async function fetchBooks() {
      try {
        const personalizedResponse = await fetch('/api/discover/personalized?limit=10')
        const personalizedData = await personalizedResponse.json()

        console.log('Personalized data received:', personalizedData)
        console.log('hasRequests:', personalizedData.hasRequests)
        console.log('popularForYou count:', personalizedData.popularForYou?.length)
        console.log('newForYou count:', personalizedData.newForYou?.length)
        console.log('authorsForYou count:', personalizedData.authorsForYou?.length)

        setPersonalizedBooks(personalizedData)
      } catch (error) {
        console.error('Failed to fetch books:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBooks()
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!searchQuery.trim()) return

    // Update URL with search query
    router.push(`/discover?q=${encodeURIComponent(searchQuery.trim())}`)
  }

  const clearSearch = () => {
    // Navigate to /discover without query params
    router.push('/discover')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-foreground-muted">Loading...</p>
      </div>
    )
  }

  console.log('Rendering with personalizedBooks:', {
    exists: !!personalizedBooks,
    hasRequests: personalizedBooks?.hasRequests,
    popularCount: personalizedBooks?.popularForYou?.length,
    newCount: personalizedBooks?.newForYou?.length,
  })

  return (
    <div className="space-y-4 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
          Discover Books
        </h1>
        <p className="text-foreground-muted">
          Search for books to request or explore popular books and authors. Lists below are personalized to your tastes!
        </p>
      </div>

      {/* Search Box */}
      <Card>
        <div className="p-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <Input
              type="text"
              placeholder="Search by title or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={searching || !searchQuery.trim()}>
              {searching ? 'Searching...' : 'Search'}
            </Button>
            {hasSearched && (
              <Button type="button" variant="outline" onClick={clearSearch}>
                Clear
              </Button>
            )}
          </form>
        </div>
      </Card>

      {/* Search Results */}
      {hasSearched && (
        <section>
          <Card className="mb-6 hover:bg-background-card">
            <CardHeader>
              <CardTitle className="text-2xl">
                Search Results
                {searchResults.length > 0 && (
                  <span className="text-foreground-muted text-base ml-2 font-normal">
                    ({searchResults.length} {searchResults.length === 1 ? 'book' : 'books'} found)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <BookGrid
            books={searchResults}
            emptyMessage="No books found. Try a different search term."
          />
        </section>
      )}

      {/* Only show sections if not searching */}
      {!hasSearched && personalizedBooks && (
        <>
          <section>
            <Card className="mb-6 hover:bg-background-card">
              <CardHeader>
                <CardTitle className="text-2xl">Popular Books</CardTitle>
              </CardHeader>
            </Card>
            <BookGrid
              books={personalizedBooks.hasRequests ? personalizedBooks.popularForYou : []}
              emptyMessage="Request some books to populate this personalized list!"
            />
          </section>

          <section>
            <Card className="mb-6 hover:bg-background-card">
              <CardHeader>
                <CardTitle className="text-2xl">New Releases</CardTitle>
              </CardHeader>
            </Card>
            <BookGrid
              books={personalizedBooks.hasRequests ? personalizedBooks.newForYou : []}
              emptyMessage="Request some books to populate this personalized list!"
            />
          </section>

          <section>
            <Card className="mb-6 hover:bg-background-card">
              <CardHeader>
                <CardTitle className="text-2xl">Recommended Authors</CardTitle>
              </CardHeader>
            </Card>
            <AuthorGrid
              authors={personalizedBooks.hasRequests ? personalizedBooks.authorsForYou : []}
              emptyMessage="Request some books to populate this personalized list!"
            />
          </section>
        </>
      )}
    </div>
  )
}

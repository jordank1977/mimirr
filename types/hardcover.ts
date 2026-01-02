// Hardcover API GraphQL response types

export interface HardcoverAuthor {
  id: number
  name: string
  slug?: string
  image?: string
}

export interface HardcoverContribution {
  author: HardcoverAuthor
  role?: string
}

export interface HardcoverSeries {
  id: number
  name: string
  slug?: string
}

export interface HardcoverBookSeries {
  series: HardcoverSeries
  position?: number
}

export interface HardcoverImage {
  url?: string
}

export interface HardcoverBook {
  id: number
  title: string
  description?: string
  slug?: string
  cached_contributors?: string
  cached_tags?: string
  contributions?: HardcoverContribution[]
}

export interface HardcoverSearchResponse {
  books: HardcoverBook[]
}

export interface HardcoverBookResponse {
  books: HardcoverBook[]
}

// Simplified book type for our application
export interface Book {
  id: string
  title: string
  subtitle?: string
  description?: string
  coverImage?: string
  author: string
  authors: string[]
  isbn?: string
  isbn13?: string
  pageCount?: number
  publishedDate?: string
  publisher?: string
  rating?: number
  series?: string
  seriesPosition?: number
  genres: string[]
}

/**
 * Transform Hardcover API response to our Book type
 */
export function transformHardcoverBook(book: HardcoverBook): Book {
  const authors = book.contributions?.map((c) => c.author.name) || []
  const primaryAuthor = authors[0] || 'Unknown Author'

  // Parse cached_tags for genres
  let genres: string[] = []
  if (book.cached_tags) {
    try {
      genres = JSON.parse(book.cached_tags).map((tag: any) => tag.name || tag)
    } catch {
      genres = []
    }
  }

  return {
    id: book.id.toString(),
    title: book.title,
    description: book.description,
    author: primaryAuthor,
    authors,
    genres,
    // Fields not available in current API
    subtitle: undefined,
    coverImage: undefined,
    isbn: undefined,
    isbn13: undefined,
    pageCount: undefined,
    publishedDate: undefined,
    publisher: undefined,
    rating: undefined,
    series: undefined,
    seriesPosition: undefined,
  }
}

// Bookinfo.pro API response types

export interface BookinfoSearchResult {
  bookId: number
  workId: number
  author?: {
    id: number
  }
}

export interface BookinfoBook {
  ForeignId: number
  Asin?: string
  Isbn13?: string
  Title: string
  Publisher?: string
  Format?: string
  EditionInformation?: string
  Language?: string
  NumPages?: number
  IsEbook?: boolean
  ImageUrl?: string
  Description?: string
  ReleaseDate?: string
  Contributors?: Array<{
    ForeignId: number
    Role: string
  }>
}

export interface BookinfoWork {
  ForeignId: number
  Title: string
  FullTitle?: string
  ShortTitle?: string
  Url?: string
  ReleaseDate?: string
  ReleaseDateRaw?: string
  RatingCount?: number
  AverageRating?: number
  Genres?: string[]
  Books?: BookinfoBook[]
  Series?: Array<{
    ForeignId: number
    PositionInSeries?: string
    SeriesPosition?: number
    Primary?: boolean
  }>
  Authors?: number[]
}

export interface BookinfoAuthor {
  ForeignId: number
  Name: string
  ImageUrl?: string
  Url?: string
  Description?: string
}

export interface BookinfoBulkResponse {
  Works: BookinfoWork[]
  Series?: Array<{
    ForeignId: number
    Title: string
    Description?: string
  }>
  Authors: BookinfoAuthor[]
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
  requestStatus?: 'pending' | 'approved' | 'declined' | 'available' | 'processing'
  requestId?: number
  availableFormat?: string
}

// Author type for recommendations
export interface Author {
  id: string
  name: string
  imageUrl?: string
  description?: string
  bookCount: number
  avgRating: number
  genres: string[]
}

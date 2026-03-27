import { db, settings } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'

export type MimirrState = 'Unowned' | 'Requested' | 'Processing' | 'Available' | 'Unreleased';

export interface TargetBookShape {
  id: string; // React key
  mimirrState?: MimirrState;
  title: string;
  author: string;
  authors: string[];
  rating: number;
  pageCount: number;
  publishedDate: string;
  publisher: string;
  isbn13: string;
  isbn?: string; // Adding isbn so TargetBookShape supports it
  description: string;
  genres: string[];
  coverImage: string | undefined;

  // Custom schema fields required by prompt mapping internally
  _rawMapping: {
    "Book Title": string;
    "Book Author": string;
    "Rating": number;
    "Pages": number;
    "Published Date": string;
    "Publisher": string;
    "ISBN": string;
    "Description": string;
    "Genres": string;
    "Cover Art": string | undefined;
  };

  // Also pass the raw ids for requesting the book later
  foreignBookId?: string;
  readarrBookId?: number;
}

export class ReadarrService {
  /**
   * Get Readarr settings
   */
  private static async getReadarrConfig() {
    const configSettings = await db.select().from(settings)

    const url = configSettings.find(s => s.key === 'bookshelf_url')?.value
    const apiKey = configSettings.find(s => s.key === 'bookshelf_api_key')?.value

    if (!url || !apiKey) {
      throw new Error('Readarr connection settings are missing.')
    }

    // Remove trailing slash
    return {
      url: url.replace(/\/$/, ''),
      apiKey
    }
  }

  /**
   * Method A: Outward Discovery
   * Step 1: Search Readarr (Initial Book List) using /search endpoint
   * Retrieves the Golden Payload with deep metadata.
   */
  static async searchBooks(query: string): Promise<TargetBookShape[]> {
    try {
      const { url, apiKey } = await this.getReadarrConfig()

      // When querying by goodreads id, we MUST NOT URL-encode the colon
      // E.g., goodreads:12345, NOT goodreads%3A12345
      const isForeignIdQuery = query.startsWith('goodreads:');
      const term = isForeignIdQuery
        ? `goodreads:${encodeURIComponent(query.replace('goodreads:', ''))}`
        : encodeURIComponent(query);

      const searchUrl = `${url}/api/v1/search?term=${term}`

      logger.info(`Searching Readarr with query: ${query}`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      try {
        const response = await fetch(searchUrl, {
          headers: {
            'X-Api-Key': apiKey,
            // Spoofed headers to unlock deep metadata (overview, editions, etc.)
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest'
          },
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(`Readarr search failed with status: ${response.status}`)
        }

        const data = await response.json()
        if (Array.isArray(data)) {
          // Keep the root wrapper so we don't throw away item.editions or item.author
          const searchResults = data.filter((item: any) => item.book)

          // Map to TargetBookShape (Golden Payload 10-field requirement)
          const mappedBooks: TargetBookShape[] = searchResults.map((item: any) => {
            const book = item.book;
            const editions = item.editions || book.editions || [];

            const firstEdition = Array.isArray(editions) && editions.length > 0 ? editions[0] : null;
            const cleanTitle = book.title?.replace(/\s+by\s+.+$/i, '').trim() || 'Unknown Title';

            let coverArt = firstEdition?.images?.[0]?.remoteUrl
                          || book.images?.find((img: any) => img.coverType === 'cover')?.remoteUrl
                          || book.images?.[0]?.remoteUrl
                          || undefined;

            if (coverArt === 'null') coverArt = undefined;

            const mapped = {
              "Book Title": cleanTitle,
              "Book Author": item.author?.authorName || book.author?.authorName || 'Unknown Author',
              "Rating": book.ratings?.value || 0,
              "Pages": book.pageCount || firstEdition?.pageCount || 0,
              "Published Date": book.releaseDate || firstEdition?.releaseDate || 'Unknown Date',
              "Publisher": item.editions?.[0]?.publisher || firstEdition?.publisher || "Unknown Publisher",
              "ISBN": item.editions?.[0]?.isbn13 || item.editions?.[0]?.isbn || firstEdition?.isbn13 || firstEdition?.isbn || "Unknown ISBN",
              "Description": item.book?.overview || book.overview || firstEdition?.overview || "No description available",
              "Genres": Array.isArray(book.genres) ? book.genres.join(", ") : "",
              "Cover Art": coverArt,
            };

            return {
              id: book.foreignBookId || book.id?.toString() || Math.random().toString(),
              title: mapped["Book Title"],
              author: mapped["Book Author"],
              authors: [mapped["Book Author"]],
              rating: mapped["Rating"],
              pageCount: mapped["Pages"],
              publishedDate: mapped["Published Date"],
              publisher: mapped["Publisher"],
              isbn13: mapped["ISBN"],
              // Optional fallback if TargetBookShape or the db schema expects isbn explicitly
              isbn: item.editions?.[0]?.isbn || firstEdition?.isbn || undefined,
              description: mapped["Description"],
              genres: Array.isArray(book.genres) ? book.genres : [],
              coverImage: mapped["Cover Art"],
              _rawMapping: mapped,
              foreignBookId: book.foreignBookId,
              readarrBookId: book.id
            };
          });

          // Import BookService here to avoid circular dependency if needed,
          // but we can also handle caching in the calling actions.
          // The prompt says "When a search is performed, immediately UPSERT all results into the book_cache table."
          const { BookService } = await import('@/lib/services/book.service');

          // Upsert all mapped books into cache sequentially
          for (const mappedBook of mappedBooks) {
            try {
              console.info(`[HYDRATE] Caching book: ${mappedBook.title} (${mappedBook.id})`);
              // Cast it to the shape BookService expects
              await BookService.cacheBook(mappedBook as any);
            } catch (err) {
              logger.error(`Failed to immediately cache book ${mappedBook.id}`, { error: err });
            }
          }

          return mappedBooks;
        }
        return []
      } finally {
        clearTimeout(timeoutId)
      }

    } catch (error) {
      logger.error('Error in ReadarrService.searchBooks:', { error })
      throw error
    }
  }

  /**
   * Method B: Inward Sync
   * Step 1: Scan local Readarr library
   */
  static async scanLocalLibrary(): Promise<any[]> {
    try {
      const { url, apiKey } = await this.getReadarrConfig()

      const scanUrl = `${url}/api/v1/book`

      logger.info(`Scanning local Readarr library`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      try {
        const response = await fetch(scanUrl, {
          headers: { 'X-Api-Key': apiKey },
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(`Readarr book fetch failed with status: ${response.status}`)
        }

        const data = await response.json()
        return Array.isArray(data) ? data : []
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      logger.error('Error in ReadarrService.scanLocalLibrary:', { error })
      throw error
    }
  }

  /**
   * Step 2: Fetch Details (Editions)
   */
  static async getBookDetails(book: any): Promise<TargetBookShape> {
    try {
      const { url, apiKey } = await this.getReadarrConfig()
      let editions = []
      let fullBook = book // Default to the basic object from lookup

      const isExternal = !book.id || book.id === 0;

      try {
        let editionUrl = ''

        // For Local Books (id > 0): Fetch full metadata and editions
        if (!isExternal) {
          const bookUrl = `${url}/api/v1/book/${book.id}`
          const bookController = new AbortController()
          const bookTimeoutId = setTimeout(() => bookController.abort(), 60000)

          try {
            const bookResponse = await fetch(bookUrl, {
              headers: { 'X-Api-Key': apiKey },
              signal: bookController.signal
            })

            if (bookResponse.ok) {
              fullBook = await bookResponse.json()
            }
          } finally {
            clearTimeout(bookTimeoutId)
          }

          editionUrl = `${url}/api/v1/edition?bookId=${book.id}`

          if (editionUrl) {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 60000)

            try {
              const response = await fetch(editionUrl, {
                headers: { 'X-Api-Key': apiKey },
                signal: controller.signal
              })

              if (response.ok) {
                editions = await response.json()
              }
            } finally {
              clearTimeout(timeoutId)
            }
          }
        } else {
            // For External Discovery, we already have the TargetBookShape from searchBooks
            // If they pass an already mapped object, return it.
            if (book._rawMapping) {
                return book;
            }
        }
      } catch (e) {
        logger.error(`Error fetching editions for book ${book.title}:`, e)
        // We don't want to throw here, we want to gracefully degrade
      }

      // Map to required schema
      const firstEdition = Array.isArray(editions) && editions.length > 0 ? editions[0] : null;

      // Clean title ("Title by Author")
      const cleanTitle = fullBook.title?.replace(/\s+by\s+.+$/i, '').trim() || 'Unknown Title'

      // Get cover art remote URL
      let coverArt = fullBook.images?.find((img: any) => img.coverType === 'cover')?.remoteUrl
                    || fullBook.images?.[0]?.remoteUrl
                    || fullBook.images?.find((img: any) => img.coverType === 'cover')?.url
                    || undefined

      if (coverArt === 'null') coverArt = undefined;

      const mapped = {
        "Book Title": cleanTitle,
        "Book Author": fullBook.author?.authorName || 'Unknown Author',
        "Rating": fullBook.ratings?.value || 0,
        "Pages": fullBook.pageCount || 0,
        "Published Date": fullBook.releaseDate || 'Unknown Date',
        "Publisher": firstEdition?.publisher || "Unknown Publisher",
        "ISBN": firstEdition?.isbn13 || "Unknown ISBN",
        "Description": fullBook.overview || firstEdition?.overview || (isExternal ? "Description available after requesting" : "No description available"),
        "Genres": Array.isArray(fullBook.genres) ? fullBook.genres.join(", ") : "",
        "Cover Art": coverArt,
      }

      return {
        id: book.foreignBookId || book.id?.toString() || Math.random().toString(),
        title: mapped["Book Title"],
        author: mapped["Book Author"],
        authors: [mapped["Book Author"]],
        rating: mapped["Rating"],
        pageCount: mapped["Pages"],
        publishedDate: mapped["Published Date"],
        publisher: mapped["Publisher"],
        isbn13: mapped["ISBN"],
        description: mapped["Description"],
        genres: Array.isArray(fullBook.genres) ? fullBook.genres : [],
        coverImage: mapped["Cover Art"],
        _rawMapping: mapped,
        foreignBookId: book.foreignBookId,
        readarrBookId: book.id
      }

    } catch (error) {
      logger.error('Error in ReadarrService.getBookDetails:', { error })

      // Fallback if everything fails
      const cleanTitle = book.title?.replace(/\s+by\s+.+$/i, '').trim() || 'Unknown Title'
      const isExternal = !book.id || book.id === 0;

      let coverArt = book.images?.[0]?.remoteUrl;
      if (coverArt === 'null') coverArt = undefined;

      const mapped = {
        "Book Title": cleanTitle,
        "Book Author": book.author?.authorName || 'Unknown Author',
        "Rating": book.ratings?.value || 0,
        "Pages": book.pageCount || 0,
        "Published Date": book.releaseDate || 'Unknown Date',
        "Publisher": "Unknown Publisher",
        "ISBN": "Unknown ISBN",
        "Description": book.overview || (isExternal ? "Description available after requesting" : "No description available"),
        "Genres": Array.isArray(book.genres) ? book.genres.join(", ") : "",
        "Cover Art": coverArt,
      }

      return {
        id: book.foreignBookId || book.id?.toString() || Math.random().toString(),
        title: mapped["Book Title"],
        author: mapped["Book Author"],
        authors: [mapped["Book Author"]],
        rating: mapped["Rating"],
        pageCount: mapped["Pages"],
        publishedDate: mapped["Published Date"],
        publisher: mapped["Publisher"],
        isbn13: mapped["ISBN"],
        description: mapped["Description"],
        genres: Array.isArray(book.genres) ? book.genres : [],
        coverImage: mapped["Cover Art"],
        _rawMapping: mapped,
        foreignBookId: book.foreignBookId,
        readarrBookId: book.id
      }
    }
  }
}

import { db, userPreferences, type UserPreferences } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { RequestService } from './request.service'
import { BookService } from './book.service'
import { BookinfoService } from './bookinfo.service'
import type { Book, Author } from '@/types/bookinfo'
import { logger } from '@/lib/utils/logger'

// Half-life = 90 days (requests older than 90 days have 50% weight)
const HALF_LIFE_DAYS = 90
const DECAY_CONSTANT = Math.log(2) / HALF_LIFE_DAYS

interface GenreWeight {
  [genre: string]: number
}

interface AuthorPreference {
  name: string
  weight: number
}

/**
 * Calculate time-based weight for a request using exponential decay
 * More recent requests have higher weight (1.0 = today, 0.5 = 90 days ago)
 */
function calculateTimeWeight(requestDate: Date): number {
  const now = new Date()
  const ageInDays = (now.getTime() - requestDate.getTime()) / (1000 * 60 * 60 * 24)
  return Math.exp(-DECAY_CONSTANT * ageInDays)
}

/**
 * Calculate genre weights from user's request history
 * Returns normalized weights (0-1) for each genre
 */
async function calculateGenreWeights(userId: number): Promise<GenreWeight> {
  const requests = await RequestService.getRequestsByUserId(userId)

  if (requests.length === 0) {
    return {}
  }

  const bookIds = requests.map(r => r.bookId)
  const booksMap = await BookService.getBooksByIds(bookIds)

  const genreScores: GenreWeight = {}

  for (const request of requests) {
    const book = booksMap.get(request.bookId)
    if (!book || !book.genres || book.genres.length === 0) continue

    const timeWeight = calculateTimeWeight(request.requestedAt)

    // Each genre in the book gets the time-weighted score
    for (const genre of book.genres) {
      genreScores[genre] = (genreScores[genre] || 0) + timeWeight
    }
  }

  // Normalize weights to 0-1 range
  const maxScore = Math.max(...Object.values(genreScores))
  if (maxScore === 0) return {}

  const normalizedWeights: GenreWeight = {}
  for (const [genre, score] of Object.entries(genreScores)) {
    normalizedWeights[genre] = score / maxScore
  }

  return normalizedWeights
}

/**
 * Calculate author preferences from user's request history
 * Returns array of {name, weight} sorted by weight descending
 */
async function calculateAuthorPreferences(userId: number): Promise<AuthorPreference[]> {
  const requests = await RequestService.getRequestsByUserId(userId)

  if (requests.length === 0) {
    return []
  }

  const bookIds = requests.map(r => r.bookId)
  const booksMap = await BookService.getBooksByIds(bookIds)

  const authorScores: { [author: string]: number } = {}

  for (const request of requests) {
    const book = booksMap.get(request.bookId)
    if (!book || !book.authors || book.authors.length === 0) continue

    const timeWeight = calculateTimeWeight(request.requestedAt)

    // Primary author gets full weight, co-authors get partial weight
    for (let i = 0; i < book.authors.length; i++) {
      const author = book.authors[i]
      const authorWeight = i === 0 ? timeWeight : timeWeight * 0.5
      authorScores[author] = (authorScores[author] || 0) + authorWeight
    }
  }

  // Normalize and sort
  const maxScore = Math.max(...Object.values(authorScores))
  if (maxScore === 0) return []

  const preferences: AuthorPreference[] = Object.entries(authorScores)
    .map(([name, score]) => ({ name, weight: score / maxScore }))
    .sort((a, b) => b.weight - a.weight)

  return preferences
}

/**
 * Extract top N genres from genre weights
 */
function extractTopGenres(genreWeights: GenreWeight, n: number = 5): string[] {
  return Object.entries(genreWeights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([genre]) => genre)
}

/**
 * Extract top N authors from author preferences
 */
function extractTopAuthors(authorPreferences: AuthorPreference[], n: number = 5): string[] {
  return authorPreferences.slice(0, n).map(a => a.name)
}

/**
 * Update user preferences based on their current request history
 * Uses time-weighted algorithm to prioritize recent requests
 */
export async function updateUserPreferences(userId: number): Promise<void> {
  try {
    const requests = await RequestService.getRequestsByUserId(userId)

    // If no requests, don't create preferences record
    if (requests.length === 0) {
      logger.debug('No requests found for user, skipping preference update', { userId })
      return
    }

    const genreWeights = await calculateGenreWeights(userId)
    const authorPreferences = await calculateAuthorPreferences(userId)
    const topGenres = extractTopGenres(genreWeights, 5)
    const topAuthors = extractTopAuthors(authorPreferences, 5)

    const lastRequestDate = requests.length > 0
      ? requests[0].requestedAt // Already sorted by desc in service
      : null

    // Generate and cache recommendations by fetching books from API based on user's genres
    let recommendedPopularBooks: string[] = []
    let recommendedNewBooks: string[] = []
    let recommendedAuthorBooks: string = '[]' // JSON string of Author objects

    try {
      const requestedBookIds = new Set(requests.map(r => r.bookId))

      // Broad genres to de-prioritize (focus on specific genres)
      const broadGenres = new Set([
        'Nonfiction',
        'Fiction',
        'Audiobook',
        'Contemporary',
        'Classics',
        'Writing',
        'Adult',
        'Literature',
        'Biography',
        'Cultural',
        'Adult Fiction',
        'Novels',
        'Biography Memoir' // Too broad, prefer specific "Memoir"
      ])
      const specificGenres = topGenres.filter(g => !broadGenres.has(g))

      logger.info('Fetching books by genre for recommendations', {
        userId,
        specificGenres,
        broadGenres: topGenres.filter(g => broadGenres.has(g))
      })

      // Fetch books for each specific genre from API (100 per genre)
      const genreBookPromises = specificGenres.map(genre =>
        BookinfoService.getBooksByGenre(genre, 100)
      )
      const genreBookArrays = await Promise.all(genreBookPromises)

      // Combine and deduplicate all genre books
      const allGenreBooks = Array.from(
        new Map(
          genreBookArrays.flat().map(book => [book.id, book])
        ).values()
      ).filter(book => !requestedBookIds.has(book.id))

      logger.info('Genre books fetched', {
        userId,
        totalBooks: allGenreBooks.length,
        booksPerGenre: genreBookArrays.map((books, i) => ({
          genre: specificGenres[i],
          count: books.length
        }))
      })

      // Score all books by genre weight match
      const scoredBooks = allGenreBooks.map(book => {
        let totalScore = 0
        let specificMatchCount = 0

        for (const genre of book.genres || []) {
          if (genreWeights[genre]) {
            if (broadGenres.has(genre)) {
              totalScore += genreWeights[genre] * 0.3
            } else {
              totalScore += genreWeights[genre] * 3
              specificMatchCount++
            }
          }
        }

        // Bonus for multiple specific genre matches
        if (specificMatchCount >= 2) totalScore *= 1.5
        if (specificMatchCount >= 3) totalScore *= 1.3

        // Add rating to score (normalize rating 0-5 to 0-1, then multiply)
        const ratingBonus = (book.rating || 0) / 5
        totalScore *= (1 + ratingBonus)

        return { book, matchScore: totalScore, rating: book.rating || 0 }
      })

      // Cache all fetched books to database for later retrieval
      logger.info('Caching genre books to database', {
        userId,
        bookCount: allGenreBooks.length
      })

      await Promise.all(
        allGenreBooks.map(book => BookService.cacheBook(book))
      )

      // Popular Books: Top-rated books from genre matches, sorted by score
      const popularSorted = [...scoredBooks].sort((a, b) => b.matchScore - a.matchScore)
      recommendedPopularBooks = popularSorted.slice(0, 5).map(s => s.book.id)

      // New Releases: Books published in last 3-6 months
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

      const recentBooks = scoredBooks.filter(({ book }) => {
        if (!book.publishedDate) return false

        // Parse the published date (format may vary)
        const pubDate = new Date(book.publishedDate)
        return !isNaN(pubDate.getTime()) && pubDate >= sixMonthsAgo
      })

      const newReleasesSorted = recentBooks.sort((a, b) => b.matchScore - a.matchScore)
      recommendedNewBooks = newReleasesSorted.slice(0, 5).map(s => s.book.id)

      logger.info('New releases filtered', {
        userId,
        totalGenreBooks: allGenreBooks.length,
        recentBooks: recentBooks.length,
        recommended: recommendedNewBooks.length
      })

      // Recommended Authors: Extract authors with multiple books in SPECIFIC genres only
      const authorMap = new Map<string, {
        name: string
        bookCount: number
        specificGenreBookCount: number // Count of books with specific (non-broad) genres
        avgRating: number
        totalRating: number
        avgMatchScore: number
        totalMatchScore: number
        genres: Set<string>
      }>()

      for (const { book, matchScore } of scoredBooks) {
        // Count how many specific genres this book has
        const bookSpecificGenres = book.genres?.filter(g => !broadGenres.has(g) && specificGenres.includes(g)) || []
        const hasSpecificGenres = bookSpecificGenres.length > 0

        for (const authorName of book.authors || [book.author]) {
          if (!authorName || authorName === 'Unknown Author') continue

          const existing = authorMap.get(authorName)
          if (existing) {
            existing.bookCount++
            if (hasSpecificGenres) {
              existing.specificGenreBookCount++
            }
            existing.totalRating += (book.rating || 0)
            existing.avgRating = existing.totalRating / existing.bookCount
            existing.totalMatchScore += matchScore
            existing.avgMatchScore = existing.totalMatchScore / existing.bookCount
            book.genres?.forEach(g => existing.genres.add(g))
          } else {
            authorMap.set(authorName, {
              name: authorName,
              bookCount: 1,
              specificGenreBookCount: hasSpecificGenres ? 1 : 0,
              avgRating: book.rating || 0,
              totalRating: book.rating || 0,
              avgMatchScore: matchScore,
              totalMatchScore: matchScore,
              genres: new Set(book.genres || [])
            })
          }
        }
      }

      // Sort authors by match score and specific genre focus - filter for relevant authors
      const topAuthors = Array.from(authorMap.values())
        .filter(a => {
          // Must have at least 2 total books and 2+ in specific genres
          if (a.bookCount < 2) return false
          if (a.specificGenreBookCount < 2) return false

          // At least 50% of their books must be in specific genres
          const specificRatio = a.specificGenreBookCount / a.bookCount
          if (specificRatio < 0.5) return false

          // Filter out authors with weak match scores (their books don't match user preferences well)
          // Require strong matches (10+) to avoid recommending authors with incidental genre overlap
          return a.avgMatchScore >= 10.0
        })
        .sort((a, b) => {
          // Primary: average match score (how well books match user preferences)
          if (Math.abs(a.avgMatchScore - b.avgMatchScore) > 2) {
            return b.avgMatchScore - a.avgMatchScore
          }
          // Secondary: number of books in specific genres
          if (a.specificGenreBookCount !== b.specificGenreBookCount) {
            return b.specificGenreBookCount - a.specificGenreBookCount
          }
          // Tertiary: average rating
          if (Math.abs(a.avgRating - b.avgRating) > 0.5) {
            return b.avgRating - a.avgRating
          }
          // Quaternary: total book count
          return b.bookCount - a.bookCount
        })
        .slice(0, 5)

      // Search for author metadata (images) from API
      const recommendedAuthors: Author[] = []
      for (const authorData of topAuthors) {
        try {
          // Search for the author to get their image
          const searchResults = await BookinfoService.searchBooks(authorData.name, 1)

          // Create author object with or without image
          const author: Author = {
            id: authorData.name.toLowerCase().replace(/\s+/g, '-'),
            name: authorData.name,
            imageUrl: searchResults[0]?.coverImage, // Use book cover as fallback for author image
            description: `Author of ${authorData.bookCount} ${authorData.bookCount === 1 ? 'book' : 'books'} in your favorite genres`,
            bookCount: authorData.bookCount,
            avgRating: authorData.avgRating,
            genres: Array.from(authorData.genres)
          }
          recommendedAuthors.push(author)
        } catch (error) {
          logger.error('Failed to fetch author metadata', { author: authorData.name, error })
          // Add author without image
          recommendedAuthors.push({
            id: authorData.name.toLowerCase().replace(/\s+/g, '-'),
            name: authorData.name,
            description: `Author of ${authorData.bookCount} ${authorData.bookCount === 1 ? 'book' : 'books'} in your favorite genres`,
            bookCount: authorData.bookCount,
            avgRating: authorData.avgRating,
            genres: Array.from(authorData.genres)
          })
        }
      }

      // Store as JSON string
      recommendedAuthorBooks = JSON.stringify(recommendedAuthors)

      logger.info('Author recommendations generated', {
        userId,
        authorCount: recommendedAuthors.length,
        authors: recommendedAuthors.map(a => a.name)
      })
    } catch (error) {
      logger.error('Failed to generate cached recommendations', { error, userId })
      // Continue anyway with empty recommendations
    }

    await db
      .insert(userPreferences)
      .values({
        userId,
        genreWeights: JSON.stringify(genreWeights),
        authorPreferences: JSON.stringify(authorPreferences),
        topGenres: JSON.stringify(topGenres),
        topAuthors: JSON.stringify(topAuthors),
        totalRequests: requests.length,
        lastRequestDate,
        recommendedPopularBooks: JSON.stringify(recommendedPopularBooks),
        recommendedNewBooks: JSON.stringify(recommendedNewBooks),
        recommendedAuthorBooks: recommendedAuthorBooks, // Already a JSON string
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          genreWeights: JSON.stringify(genreWeights),
          authorPreferences: JSON.stringify(authorPreferences),
          topGenres: JSON.stringify(topGenres),
          topAuthors: JSON.stringify(topAuthors),
          totalRequests: requests.length,
          lastRequestDate,
          recommendedPopularBooks: JSON.stringify(recommendedPopularBooks),
          recommendedNewBooks: JSON.stringify(recommendedNewBooks),
          recommendedAuthorBooks: recommendedAuthorBooks, // Already a JSON string
          updatedAt: new Date(),
        },
      })

    logger.info('User preferences updated', {
      userId,
      genreCount: Object.keys(genreWeights).length,
      authorCount: authorPreferences.length,
      totalRequests: requests.length,
      cachedPopular: recommendedPopularBooks.length,
      cachedNew: recommendedNewBooks.length,
      cachedAuthors: recommendedAuthorBooks.length,
    })
  } catch (error) {
    logger.error('Failed to update user preferences', { error, userId })
    throw error
  }
}

/**
 * Get user preferences from database
 */
export async function getUserPreferences(userId: number): Promise<UserPreferences | null> {
  try {
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))

    return prefs || null
  } catch (error) {
    logger.error('Failed to get user preferences', { error, userId })
    return null
  }
}

/**
 * Get set of book IDs the user has already requested (for exclusion filtering)
 */
export async function getRequestedBookIds(userId: number): Promise<Set<string>> {
  try {
    const requests = await RequestService.getRequestsByUserId(userId)
    return new Set(requests.map(r => r.bookId))
  } catch (error) {
    logger.error('Failed to get requested book IDs', { error, userId })
    return new Set()
  }
}

/**
 * Get popular books matching user's genre preferences
 */
export async function getPopularBooksForUser(userId: number, limit: number = 10): Promise<Book[]> {
  try {
    const prefs = await getUserPreferences(userId)
    if (!prefs || prefs.totalRequests === 0) {
      return []
    }

    const topGenres = JSON.parse(prefs.topGenres) as string[]
    if (topGenres.length === 0) {
      return []
    }

    // Fetch more books for filtering
    const popularBooks = await BookService.getPopularBooks(50)
    const requestedBookIds = await getRequestedBookIds(userId)

    // Filter by genre match and exclude already requested
    const matchedBooks = popularBooks.filter(book => {
      if (requestedBookIds.has(book.id)) return false
      if (!book.genres || book.genres.length === 0) return false
      return book.genres.some(genre => topGenres.includes(genre))
    })

    // Score by genre match strength
    const genreWeights = JSON.parse(prefs.genreWeights) as GenreWeight
    const scoredBooks = matchedBooks.map(book => {
      const matchScore = book.genres
        .map(g => genreWeights[g] || 0)
        .reduce((sum, w) => sum + w, 0) / book.genres.length

      return { book, matchScore }
    })

    scoredBooks.sort((a, b) => b.matchScore - a.matchScore)

    return scoredBooks.slice(0, limit).map(s => s.book)
  } catch (error) {
    logger.error('Failed to get popular books for user', { error, userId })
    return []
  }
}

/**
 * Get new releases matching user's genre preferences
 */
export async function getNewBooksForUser(userId: number, limit: number = 10): Promise<Book[]> {
  try {
    const prefs = await getUserPreferences(userId)
    if (!prefs || prefs.totalRequests === 0) {
      return []
    }

    const topGenres = JSON.parse(prefs.topGenres) as string[]
    if (topGenres.length === 0) {
      return []
    }

    const newReleases = await BookService.getNewReleases(50)
    const requestedBookIds = await getRequestedBookIds(userId)

    const matchedBooks = newReleases.filter(book => {
      if (requestedBookIds.has(book.id)) return false
      if (!book.genres || book.genres.length === 0) return false
      return book.genres.some(genre => topGenres.includes(genre))
    })

    // Same scoring logic as popular books
    const genreWeights = JSON.parse(prefs.genreWeights) as GenreWeight
    const scoredBooks = matchedBooks.map(book => {
      const matchScore = book.genres
        .map(g => genreWeights[g] || 0)
        .reduce((sum, w) => sum + w, 0) / book.genres.length

      return { book, matchScore }
    })

    scoredBooks.sort((a, b) => b.matchScore - a.matchScore)

    return scoredBooks.slice(0, limit).map(s => s.book)
  } catch (error) {
    logger.error('Failed to get new books for user', { error, userId })
    return []
  }
}

/**
 * Get author recommendations based on user's favorite authors
 */
export async function getAuthorRecommendations(userId: number, limit: number = 10): Promise<Book[]> {
  try {
    const prefs = await getUserPreferences(userId)
    if (!prefs || prefs.totalRequests === 0) {
      return []
    }

    const topAuthors = JSON.parse(prefs.topAuthors) as string[]
    if (topAuthors.length === 0) {
      return []
    }

    const requestedBookIds = await getRequestedBookIds(userId)

    // Search for each top author and get their books
    const authorBooks: Book[] = []

    for (const author of topAuthors) {
      try {
        const books = await BookService.searchBooks(author, 10)

        // Filter to books actually by this author (case-insensitive match)
        const authorBooksByName = books.filter(book =>
          book.authors.some(a =>
            a.toLowerCase().includes(author.toLowerCase()) ||
            author.toLowerCase().includes(a.toLowerCase())
          )
        )

        authorBooks.push(...authorBooksByName)
      } catch (error) {
        logger.error('Failed to fetch author books', { author, error })
      }
    }

    // Remove duplicates and already requested books
    const uniqueBooks = Array.from(
      new Map(authorBooks.map(b => [b.id, b])).values()
    ).filter(book => !requestedBookIds.has(book.id))

    // Sort by author preference weight
    const authorPreferences = JSON.parse(prefs.authorPreferences) as AuthorPreference[]
    const scoredBooks = uniqueBooks.map(book => {
      const matchScore = book.authors
        .map(a => {
          // Find matching author preference (case-insensitive)
          const matchingPref = authorPreferences.find(
            p => a.toLowerCase().includes(p.name.toLowerCase()) ||
                 p.name.toLowerCase().includes(a.toLowerCase())
          )
          return matchingPref?.weight || 0
        })
        .reduce((max, w) => Math.max(max, w), 0)

      return { book, matchScore }
    })

    scoredBooks.sort((a, b) => b.matchScore - a.matchScore)

    return scoredBooks.slice(0, limit).map(s => s.book)
  } catch (error) {
    logger.error('Failed to get author recommendations', { error, userId })
    return []
  }
}

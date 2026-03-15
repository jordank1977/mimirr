import { BookshelfConfig } from '@/types/bookshelf.types';
import { fetchWithTimeout, apiGet, apiPost, apiPut } from './api';
import { fetchLibraryWithCache } from './cache';
import { logger } from '@/lib/utils/logger';

/**
 * Check if a book already exists in the Bookshelf library
 * Returns the book's status if found, null if not in library
 */
export async function getLibraryBooks(config: BookshelfConfig): Promise<any[]> {
  try {
    return await apiGet<any[]>(config, '/api/v1/book')
  } catch (error) {
    logger.error('Failed to get library books from Bookshelf', { error })
    return []
  }
}

export async function checkBookInLibrary(
  config: BookshelfConfig,
  bookTitle: string,
  authorName: string
): Promise<{
  exists: boolean
  status?: 'available' | 'downloading' | 'missing'
  bookFileCount?: number
  format?: string
}> {
  try {
    const now = Date.now();
    let books: any[];

    // Use the cache utility to fetch books
    books = await fetchLibraryWithCache(config);

    if (books.length === 0) {
      return { exists: false };
    }

    logger.info('Fetched books from Bookshelf', {
      bookCount: books.length,
      searchTitle: bookTitle,
      searchAuthor: authorName,
    });

    // Search for the book by title and author
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = authorName.toLowerCase().trim();

    logger.debug('Searching for book in library', {
      normalizedTitle,
      normalizedAuthor,
      sampleTitles: books.slice(0, 5).map((b: any) => ({
        title: b.title,
        author: b.author?.authorName,
      })),
    });

    // First, find all books that match the title
    const titleMatches = books.filter((book: any) => {
      const bookTitle = book.title?.toLowerCase().trim();
      return bookTitle === normalizedTitle || bookTitle?.includes(normalizedTitle);
    });

    if (titleMatches.length > 0) {
      logger.info('Found books matching title', {
        count: titleMatches.length,
        matches: titleMatches.map((b: any) => ({
          title: b.title,
          author: b.author?.authorName,
          fileCount: b.statistics?.bookFileCount,
        })),
      });
    }

    // Try to find exact match with title and author
    const matchingBook = titleMatches.find((book: any) => {
      const bookAuthor = book.author?.authorName?.toLowerCase().trim() || '';
      // More flexible author matching
      return bookAuthor === normalizedAuthor ||
             bookAuthor.includes(normalizedAuthor) ||
             normalizedAuthor.includes(bookAuthor);
    });

    // If no exact author match but we have title matches, use the first one
    // (assuming the title is unique enough)
    const finalMatch = matchingBook || (titleMatches.length === 1 ? titleMatches[0] : null);

    if (!finalMatch) {
      logger.info('Book not found in Bookshelf library', {
        searchTitle: bookTitle,
        searchAuthor: authorName,
      });
      return { exists: false };
    }

    // Check if the book has files downloaded
    const bookFileCount = finalMatch.statistics?.bookFileCount || 0;

    logger.info('Book found in Bookshelf library', {
      title: finalMatch.title,
      author: finalMatch.author?.authorName,
      bookFileCount,
      grabbed: finalMatch.grabbed,
      monitored: finalMatch.monitored,
    });

    if (bookFileCount > 0) {
      // Fetch book files to get format information
      let format: string | undefined;
      try {
        const bookFileUrl = `/api/v1/bookfile?bookId=${finalMatch.id}`;
        logger.debug('Fetching book files for format info', { url: bookFileUrl, bookId: finalMatch.id });

        const bookFiles = await fetchWithTimeout<any[]>(config, bookFileUrl);

        if (bookFiles.length > 0) {
          // Get format from first book file (most recent or primary)
          format = bookFiles[0]?.quality?.quality?.name;
          logger.info('Book format retrieved', {
            bookId: finalMatch.id,
            format,
            fileCount: bookFiles.length
          });
        }
      } catch (error) {
        logger.warn('Error fetching book file format', { error, bookId: finalMatch.id });
        // Continue without format info - not critical
      }

      return {
        exists: true,
        status: 'available',
        bookFileCount,
        format,
      };
    }

    if (finalMatch.grabbed === true) {
      return {
        exists: true,
        status: 'downloading',
        bookFileCount: 0,
      };
    }

    return {
      exists: true,
      status: 'missing',
      bookFileCount: 0,
    };
  } catch (error) {
    logger.error('Failed to check book in Bookshelf library', {
      error,
      bookTitle,
      authorName,
    });
    // Return false on error to avoid blocking requests
    return { exists: false };
  }
}

/**
 * Lookup an author in Bookshelf's metadata provider
 */
export async function lookupAuthor(
  config: BookshelfConfig,
  authorName: string
): Promise<any[]> {
  try {
    const url = `/api/v1/author/lookup?term=${encodeURIComponent(authorName)}`;
    logger.debug('Looking up author in Bookshelf', { url, authorName });

    const results = await fetchWithTimeout<any[]>(config, url);

    logger.debug('Author lookup results', { count: results.length });

    // Helper function to normalize text for matching (titles, authors)
    const normalizeText = (text: string): string => {
      return text
        .toLowerCase()
        .split(':')[0] // Remove subtitles
        .trim()
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize whitespace
    };

    const normalizedSearchName = normalizeText(authorName);
    const searchWords = normalizedSearchName.split(' ');

    // Filter results to ensure strict author matching
    // We want to avoid "Sara Ackerman" matching "Sara Holly Ackerman"
    // So we require that the result contains exactly the same words as the search,
    // or at least that the search isn't missing any words from the result (or vice-versa for middle names).
    // Actually, middle names are tricky. If user searched "Sara Ackerman", they probably don't want "Sara Holly Ackerman".
    const strictResults = results.filter((author: any) => {
      const normalizedResultName = normalizeText(author.authorName || '');
      const resultWords = normalizedResultName.split(' ');
      
      // Exact match of all words (ignoring order)
      const wordsInResult = searchWords.every(word => resultWords.includes(word));
      const wordsInSearch = resultWords.every(word => searchWords.includes(word));
      
      return wordsInResult && wordsInSearch;
    });

    if (strictResults.length > 0) {
      logger.info('Strict author lookup successful', {
        originalCount: results.length,
        strictCount: strictResults.length,
        bestMatch: strictResults[0].authorName
      });
      return strictResults;
    }

    // If no strict matches, return nothing to prevent wrong author addition
    logger.warn('No strict author matches found', { 
      authorName, 
      foundAuthors: results.map((a: any) => a.authorName).slice(0, 3) 
    });
    return [];
  } catch (error) {
    logger.error('Failed to lookup author in Bookshelf', { error, authorName });
    return [];
  }
}

/**
 * Search for books using Bookshelf's unified search endpoint
 * Returns full metadata including description, ratings, and high-res covers
 */
export async function searchBooks(
  config: BookshelfConfig,
  term: string
): Promise<any[]> {
  try {
    const url = `/api/v1/search?term=${encodeURIComponent(term)}`;
    logger.debug('Searching books via Bookshelf unified search', { url, term });

    const searchResults = await fetchWithTimeout<any[]>(config, url);

    // Filter to only include book results (not author results)
    const bookResults = searchResults
      .filter((result: any) => result.book)
      .map((result: any) => result.book);
    
    logger.debug('Bookshelf search results', { 
      totalResults: searchResults.length,
      bookResults: bookResults.length 
    });
    
    return bookResults;
  } catch (error) {
    logger.error('Failed to search books via Bookshelf', { error, term });
    return [];
  }
}

/**
 * Get root folders from Bookshelf
 */
export async function getRootFolders(config: BookshelfConfig): Promise<any[]> {
  try {
    const url = '/api/v1/rootFolder';

    const folders = await fetchWithTimeout<any[]>(config, url);
    return folders;
  } catch (error) {
    logger.error('Failed to get root folders', { error });
    return [];
  }
}

/**
 * Add a book to Bookshelf
 */
export async function addBook(
  config: BookshelfConfig,
  bookData: {
    title: string
    author: string
    foreignBookId: string
    qualityProfileId: number
    rootFolderPath: string
  }
): Promise<{ success: boolean; bookshelfId?: number; foreignBookId?: string; error?: string; requiresManualIntervention?: boolean; message?: string }> {
  try {
    const clean = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanedTargetAuthor = clean(bookData.author);
    
    // Step 1: The Atomic Search & Filter
    const searchUrl = `/api/v1/search?term=${encodeURIComponent(`${bookData.title} ${bookData.author}`)}`;
    logger.debug('Step 1: Atomic Search', { searchUrl });
    
    const searchResults = await fetchWithTimeout<any[]>(config, searchUrl);

    const match = searchResults.find((result: any) => 
      result.book && result.book.author && clean(result.book.author.authorName) === cleanedTargetAuthor
    );

    if (!match || !match.book) {
      return { success: false, error: 'Book not found in Readarr search or author mismatch' };
    }

    const basePayload = match.book;

    // Step 2: The Book Presence Check
    try {
      const library = await fetchWithTimeout<any[]>(config, '/api/v1/book');
      const existingBook = library.find((b: any) => String(b.foreignBookId) === String(bookData.foreignBookId));

      if (existingBook) {
        // Branch A (Exists)
        if (existingBook.monitored === false) {
          await apiPut(config, '/api/v1/book/monitor', { bookIds: [existingBook.id], monitored: true });
        }
        return await executeHandshakeAndSearch(existingBook.id, existingBook.authorId);
      }
    } catch (error) {
      // Continue if library fetch fails
      logger.warn('Failed to fetch library, continuing with book addition', { error });
    }

    // Step 3: The Circuit Breaker (Author Deduplication)
    // Branch B (New Book)
    try {
      const authors = await fetchWithTimeout<any[]>(config, '/api/v1/author');
      const existingAuthor = authors.find((a: any) => clean(a.authorName) === cleanedTargetAuthor);

      if (existingAuthor) {
        return {
          success: false,
          requiresManualIntervention: true,
          message: "MIMIRR_MANUAL_INTERVENTION_REQUIRED: Author already exists in Readarr. Due to Goodreads metadata conflicts, adding this book automatically will create a duplicate author profile. Please add this book manually."
        };
      }
    } catch (error) {
      // Continue if authors fetch fails
      logger.warn('Failed to fetch authors, continuing with book addition', { error });
    }

    // Step 4: The Atomic POST (Ironclad Locks)
    const payload = {
      ...basePayload,
      monitored: true,
      authorId: 0,
      addOptions: { searchForNewBook: false },
      author: {
        ...basePayload.author,
        qualityProfileId: bookData.qualityProfileId,
        metadataProfileId: 1,
        monitored: true,
        monitorNewItems: "none",
        rootFolderPath: bookData.rootFolderPath,
        addOptions: {
          searchForMissingBooks: false,
          booksToMonitor: [basePayload.foreignBookId]
        }
      }
    };

    const addedBook = await apiPost<any>(config, '/api/v1/book', payload);
    return await executeHandshakeAndSearch(addedBook.id, addedBook.authorId);

    // Helper function for Steps 5 and 6
    async function executeHandshakeAndSearch(bookId: number, authorId?: number) {
      // Step 5: The Status-Aware Polling Handshake
      let attempts = 0;
      const maxAttempts = 20;
      while (attempts < maxAttempts) {
        try {
          const commands = await fetchWithTimeout<any[]>(config, '/api/v1/command');
          
          // Observer: Check for any failure related to our specific book or author
          const failedCommand = commands.find((cmd: any) => 
            cmd.status === 'failed' && 
            (
              (cmd.bookId && String(cmd.bookId) === String(bookId)) || 
              (cmd.authorId && authorId && String(cmd.authorId) === String(authorId)) ||
              (cmd.body && cmd.body.bookIds && cmd.body.bookIds.map(String).includes(String(bookId))) ||
              (cmd.options && cmd.options.bookIds && cmd.options.bookIds.map(String).includes(String(bookId)))
            )
          );
          
          if (failedCommand) {
             return { success: false, error: `Readarr command failed: ${failedCommand.message || failedCommand.name}` };
          }
          
          const isProcessing = commands.some((cmd: any) => 
            (cmd.status === 'started' || cmd.status === 'queued') &&
            (
              (cmd.bookId && String(cmd.bookId) === String(bookId)) || 
              (cmd.authorId && authorId && String(cmd.authorId) === String(authorId)) ||
              (cmd.body && cmd.body.bookIds && cmd.body.bookIds.map(String).includes(String(bookId))) ||
              (cmd.options && cmd.options.bookIds && cmd.options.bookIds.map(String).includes(String(bookId)))
            )
          );
          if (!isProcessing) break;
        } catch (e) {
          // Ignore fetch errors during polling
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
        attempts++;
      }

      // Step 6: The Final Verification & Explicit Search
      let verificationAttempts = 0;
      const maxVerificationAttempts = 5;
      let isBookReady = false;
      
      while (verificationAttempts < maxVerificationAttempts) {
        try {
          // Readarr API quirk: Fetch the author's library array to get full objects safely
          const verificationUrl = authorId 
            ? `/api/v1/book?authorId=${authorId}`
            : `/api/v1/book/${bookId}`;
            
          const responseData = await fetchWithTimeout<any>(config, verificationUrl);
          const verifiedBook = authorId 
            ? Array.isArray(responseData) ? responseData.find((b: any) => String(b.id) === String(bookId)) : null
            : responseData;
            
          if (verifiedBook && verifiedBook.editions && verifiedBook.editions.length > 0) {
            isBookReady = true;
            break;
          }
        } catch (e) {
          // Not found yet, wait and retry
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
        verificationAttempts++;
      }
      
      // If the book never initializes, we shouldn't throw an error because the book is physically created in Readarr,
      // but we will log a warning or maybe just proceed. A timeout error here shouldn't mark request as failure.

      try {
        await apiPost(config, '/api/v1/command', { name: 'BookSearch', bookIds: [bookId] });
      } catch (e) {
        // Ignore search command errors
      }

      return { success: true, bookshelfId: bookId, foreignBookId: basePayload.foreignBookId };
    }

  } catch (error: any) {
    if (error.name === 'AbortError') return { success: false, error: 'Bookshelf Connection Timeout' };
    return { success: false, error: error.message };
  }
}

/**
 * Get status of a specific book from Bookshelf
 * @param config - Bookshelf configuration
 * @param bookId - The book ID in Bookshelf (stored as bookshelfId in requests)
 * @param foreignBookId - The Goodreads book ID we're monitoring
 * @param title - The book title for fallback matching
 */
export async function getAuthorBookStatus(
  config: BookshelfConfig,
  bookId: number,
  foreignBookId: string,
  title: string
): Promise<{
  status: 'available' | 'downloading' | 'missing' | 'error'
  bookFileCount?: number
  bookshelfId?: number
  error?: string
  releaseDate?: string
}> {
  try {
    // Get single book directly by its Readarr bookId
    const url = `/api/v1/book/${bookId}`;

    logger.debug('Checking book status in Bookshelf', {
      url,
      bookId,
      foreignBookId,
      title
    });

    let book: any;
    try {
      book = await fetchWithTimeout<any>(config, url);
    } catch (err: any) {
      if (err.message && err.message.includes('404')) {
        logger.debug('Book not found by ID in Bookshelf, attempting self-healing via library cache', {
          bookId,
          foreignBookId,
          title
        });

        // Try self-healing via cache and foreignBookId
        try {
          const library = await fetchLibraryWithCache(config);
          const matchedBook = library.find((b: any) => String(b.foreignBookId) === String(foreignBookId));

          if (matchedBook && matchedBook.id) {
            logger.info('Self-healing successful: found book by foreignBookId', {
              oldBookId: bookId,
              newBookId: matchedBook.id,
              foreignBookId
            });
            book = matchedBook;
          } else {
            logger.error('Book not found in Bookshelf after self-healing attempt', {
              bookId,
              foreignBookId,
              title
            });
            return {
              status: 'error',
              bookshelfId: undefined,
              error: 'Book not found in Bookshelf'
            };
          }
        } catch (healingErr) {
          logger.error('Self-healing attempt failed', { error: healingErr });
          return {
            status: 'error',
            bookshelfId: undefined,
            error: 'Book not found in Bookshelf and self-healing failed'
          };
        }
      } else {
        throw err;
      }
    }

    if (!book || !book.id) {
      logger.error('Invalid book response from Bookshelf', {
        bookId: book?.id || bookId,
        foreignBookId,
        title
      });
      return {
        status: 'error',
        bookshelfId: undefined,
        error: 'Invalid book response from Bookshelf'
      };
    }

    const bookFileCount = book.statistics?.bookFileCount || 0;
    const hasFile = book.hasFile === true;
    const releaseDate = book.releaseDate;

    logger.debug('Book status retrieved', {
      bookId: book.id,
      foreignBookId: book.foreignBookId,
      bookFileCount,
      hasFile,
      grabbed: book.grabbed,
      monitored: book.monitored,
      releaseDate
    });

    // Determine status based on book data
    if (bookFileCount > 0 || hasFile) {
      return {
        status: 'available',
        bookFileCount,
        bookshelfId: book.id,
        releaseDate
      };
    }

    if (book.grabbed === true) {
      return {
        status: 'downloading',
        bookFileCount: 0,
        bookshelfId: book.id,
        releaseDate
      };
    }

    return {
      status: 'missing',
      bookFileCount: 0,
      bookshelfId: book.id,
      releaseDate
    };
  } catch (error) {
    logger.error('Failed to get book status from Bookshelf', {
      error,
      bookId,
      foreignBookId,
      title
    });
    return {
      status: 'error',
      bookshelfId: undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

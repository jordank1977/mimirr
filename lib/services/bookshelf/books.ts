import { BookshelfConfig } from '@/types/bookshelf.types';
import { fetchWithTimeout, apiGet, apiPost, apiPut } from './api';
import { fetchLibraryWithCache } from './cache';
import { logger } from '@/lib/utils/logger';
import { db, libraryBooks } from '@/lib/db';
import { eq, or, like } from 'drizzle-orm';
import {
  getLibraryAuthors,
  lookupAuthor,
  addAuthor,
  refreshAuthor,
  getAuthorBooks,
} from './authors';

/**
 * Check if a book already exists in the Bookshelf library
 * Returns the book's status if found, null if not in library
 */
export async function getLibraryBooks(config: BookshelfConfig): Promise<any[]> {
  try {
    return await apiGet<any[]>(config, '/api/v1/book')
  } catch (error) {
    logger.error('Failed to get library books from Bookshelf', { error: error instanceof Error ? error.message : error })
    return []
  }
}

export async function getBook(config: BookshelfConfig, bookId: number): Promise<any> {
  try {
    return await apiGet<any>(config, `/api/v1/book/${bookId}`)
  } catch (error) {
    logger.error(`Failed to get book ${bookId} from Bookshelf`, { error: error instanceof Error ? error.message : error })
    return null
  }
}

export async function getBookEditions(config: BookshelfConfig, bookId: number): Promise<any[]> {
  try {
    return await apiGet<any[]>(config, `/api/v1/edition?bookId=${bookId}`)
  } catch (error) {
    logger.error(`Failed to get editions for book ${bookId} from Bookshelf`, { error: error instanceof Error ? error.message : error })
    return []
  }
}

export async function checkBookInLibrary(
  config: BookshelfConfig,
  foreignBookId: string,
  bookTitle: string,
  authorName: string
): Promise<{
  exists: boolean
  status?: string
  bookshelfId?: number
}> {
  try {
    // 1. Target SQL Query by foreignBookId
    if (foreignBookId) {
      const idMatch = await db
        .select()
        .from(libraryBooks)
        .where(eq(libraryBooks.foreignBookId, foreignBookId))
        .limit(1);

      if (idMatch.length > 0) {
        if (config?.url && config?.apiKey && idMatch[0].bookshelfId) {
          try {
            const liveBook = await apiGet<any>(config, `/api/v1/book/${idMatch[0].bookshelfId}`)
            if (liveBook && liveBook.id) {
              logger.debug('Book found in Bookshelf library (ID match)', {
                foreignBookId,
                status: idMatch[0].status,
                bookshelfId: idMatch[0].bookshelfId,
              })

              return {
                exists: true,
                status: idMatch[0].status,
                bookshelfId: idMatch[0].bookshelfId,
              }
            }
          } catch (e: any) {
            if (e?.message?.includes('404')) {
              logger.info('Book not found in Bookshelf (404), purging stale entry from libraryBooks cache', {
                foreignBookId,
                bookshelfId: idMatch[0].bookshelfId,
              })
              await db.delete(libraryBooks).where(eq(libraryBooks.foreignBookId, foreignBookId))
            } else {
              logger.debug('Book found in Bookshelf library cache (fallback on network error)', {
                foreignBookId,
                status: idMatch[0].status,
                bookshelfId: idMatch[0].bookshelfId,
              })
              return {
                exists: true,
                status: idMatch[0].status,
                bookshelfId: idMatch[0].bookshelfId,
              }
            }
          }
        } else {
          logger.debug('Book found in Bookshelf library (ID match)', {
            foreignBookId,
            status: idMatch[0].status,
            bookshelfId: idMatch[0].bookshelfId,
          })

          return {
            exists: true,
            status: idMatch[0].status,
            bookshelfId: idMatch[0].bookshelfId || undefined,
          }
        }
      }
    }

    // 2. Fallback SQL Query by Title and Author
    const normalizedTitle = bookTitle.toLowerCase().trim()
    const normalizedAuthor = authorName.toLowerCase().trim()

    // Use a basic SQL like approach to match the title
    // In SQLite, LIKE is case-insensitive
    if (normalizedTitle) {
      const fuzzyMatches = await db
        .select()
        .from(libraryBooks)
        .where(like(libraryBooks.title, `%${normalizedTitle}%`))

      if (fuzzyMatches.length > 0) {
        const exactMatch = fuzzyMatches.find(book => {
          const titleMatches = book.title?.toLowerCase().trim() === normalizedTitle
          const authorMatches = book.authorName?.toLowerCase().trim().includes(normalizedAuthor) ||
                                normalizedAuthor.includes(book.authorName?.toLowerCase().trim() || '')
          return titleMatches && authorMatches
        })

        const finalMatch = exactMatch || (fuzzyMatches.length === 1 ? fuzzyMatches[0] : null)

        if (finalMatch) {
          if (config?.url && config?.apiKey && finalMatch.bookshelfId) {
            try {
              const liveBook = await apiGet<any>(config, `/api/v1/book/${finalMatch.bookshelfId}`)
              if (liveBook && liveBook.id) {
                logger.debug('Book found in Bookshelf library (Fuzzy match)', {
                  title: bookTitle,
                  authorName,
                  status: finalMatch.status,
                  bookshelfId: finalMatch.bookshelfId,
                })

                return {
                  exists: true,
                  status: finalMatch.status,
                  bookshelfId: finalMatch.bookshelfId,
                }
              }
            } catch (e: any) {
              if (e?.message?.includes('404')) {
                logger.info('Fuzzy matched book not found in Bookshelf (404), purging stale entry from libraryBooks cache', {
                  foreignBookId: finalMatch.foreignBookId,
                  bookshelfId: finalMatch.bookshelfId,
                })
                await db.delete(libraryBooks).where(eq(libraryBooks.foreignBookId, finalMatch.foreignBookId))
              } else {
                return {
                  exists: true,
                  status: finalMatch.status,
                  bookshelfId: finalMatch.bookshelfId,
                }
              }
            }
          } else {
            logger.debug('Book found in Bookshelf library (Fuzzy match)', {
              title: bookTitle,
              authorName,
              status: finalMatch.status,
              bookshelfId: finalMatch.bookshelfId,
            })

            return {
              exists: true,
              status: finalMatch.status,
              bookshelfId: finalMatch.bookshelfId || undefined,
            }
          }
        }
      }
    }

    logger.debug('Book not found in Bookshelf library', {
      foreignBookId,
      searchTitle: bookTitle,
      searchAuthor: authorName,
    });

    return { exists: false };
  } catch (error) {
    logger.error('Failed to check book in local library cache', {
      error,
      foreignBookId,
      bookTitle,
      authorName,
    });
    // Return false on error to avoid blocking requests
    return { exists: false };
  }
}

/**
 * Re-export lookupAuthor for backward compatibility
 */
export { lookupAuthor };

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
    logger.error('Failed to search books via Bookshelf', { error: error instanceof Error ? error.message : error, term });
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
    logger.error('Failed to get root folders', { error: error instanceof Error ? error.message : error });
    return [];
  }
}

/**
 * Set a book to monitored in Bookshelf (Readarr).
 * Resilient implementation:
 * 1. Attempts Readarr's dedicated bulk monitoring endpoint: PUT /api/v1/book/monitor ({ bookIds: [targetBook.id], monitored: true })
 * 2. If that fails, falls back to updating the full book entity via PUT /api/v1/book/{id}
 */
async function setBookMonitored(
  config: BookshelfConfig,
  targetBook: any,
  author: any,
  bookData: {
    qualityProfileId?: number;
    rootFolderPath?: string;
  }
): Promise<void> {
  try {
    logger.info('Setting book to monitored via /api/v1/book/monitor', {
      bookId: targetBook.id,
      foreignBookId: targetBook.foreignBookId,
    });
    await apiPut(config, '/api/v1/book/monitor', {
      bookIds: [targetBook.id],
      monitored: true,
    });
    logger.info('Successfully set book to monitored via /api/v1/book/monitor', {
      bookId: targetBook.id,
    });
  } catch (monitorError) {
    logger.warn('Failed to monitor book via /api/v1/book/monitor, attempting fallback PUT /api/v1/book/:id', {
      bookId: targetBook.id,
      error: monitorError instanceof Error ? monitorError.message : monitorError,
    });

    const updatePayload = {
      ...targetBook,
      monitored: true,
      qualityProfileId: bookData.qualityProfileId || targetBook.qualityProfileId,
      rootFolderPath: bookData.rootFolderPath || targetBook.rootFolderPath || author?.rootFolderPath,
      authorId: author?.id || targetBook.authorId,
      addOptions: { searchForNewBook: true },
      author: {
        ...(targetBook.author || author),
        qualityProfileId: bookData.qualityProfileId || author?.qualityProfileId,
        metadataProfileId: 1,
        rootFolderPath: bookData.rootFolderPath || author?.rootFolderPath,
        monitored: true,
        monitorNewItems: 'none',
      },
      editions: targetBook.editions && targetBook.editions.length > 0
        ? targetBook.editions.map((ed: any) => ({ ...ed, monitored: true }))
        : [{
            foreignEditionId: targetBook.foreignEditionId || '0',
            monitored: true,
          }],
    };

    await apiPut<any>(config, `/api/v1/book/${targetBook.id}`, updatePayload);
    logger.info('Successfully updated book via PUT /api/v1/book/:id fallback', {
      bookId: targetBook.id,
    });
  }
}

/**
 * Attempt to directly add a book to Bookshelf via POST /api/v1/book
 * using metadata from Bookshelf's unified search.
 * Bypasses metadata profile minPopularity filters for books not present in the author's general catalogue.
 */
async function directAddBookFromSearch(
  config: BookshelfConfig,
  authorId: number,
  targetForeignBookId: string,
  bookTitle: string,
  bookAuthor: string
): Promise<any | null> {
  try {
    let searchCandidates: any[] = [];
    if (targetForeignBookId) {
      searchCandidates = await searchBooks(config, `work:${targetForeignBookId}`);
    }
    if (!searchCandidates || searchCandidates.length === 0) {
      searchCandidates = await searchBooks(config, `${bookTitle} ${bookAuthor}`);
    }

    const cleanStr = (str: string) => (str || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const targetClean = cleanStr(bookTitle);

    const candidate = searchCandidates.find((b: any) =>
      (targetForeignBookId && String(b.foreignBookId) === targetForeignBookId) ||
      cleanStr(b.title) === targetClean
    );

    if (!candidate) {
      logger.warn('directAddBookFromSearch: No matching book candidate found in search', {
        targetForeignBookId,
        bookTitle,
      });
      return null;
    }

    const payload = {
      ...candidate,
      authorId,
      monitored: true,
      addOptions: {
        searchForNewBook: true,
      },
    };

    logger.info('directAddBookFromSearch: Directly adding book via POST /api/v1/book', {
      title: candidate.title,
      foreignBookId: candidate.foreignBookId,
      authorId,
    });

    const addedBook = await apiPost<any>(config, '/api/v1/book', payload);
    if (addedBook && addedBook.id) {
      logger.info('directAddBookFromSearch: Successfully added book via POST /api/v1/book', {
        bookId: addedBook.id,
        foreignBookId: addedBook.foreignBookId,
      });
      return addedBook;
    }
  } catch (err) {
    logger.warn('directAddBookFromSearch: POST /api/v1/book failed', {
      error: err instanceof Error ? err.message : err,
      targetForeignBookId,
      bookTitle,
    });
  }
  return null;
}

/**
 * Add a book to Bookshelf using Author-First orchestration:
 * - Branch 1: If the author already exists in Readarr, locate the book in their catalogue
 *   (refreshing if missing), monitor the requested book (PUT), and trigger search.
 * - Branch 2: If the author does not exist, add the author with all catalogue books unmonitored,
 *   wait for hydration, monitor the requested book (PUT), and trigger search.
 */
export async function addBook(
  config: BookshelfConfig,
  bookData: {
    title: string;
    author: string;
    foreignBookId: string;
    foreignAuthorId?: string;
    qualityProfileId: number;
    rootFolderPath: string;
  }
): Promise<{
  success: boolean;
  bookshelfId?: number;
  foreignBookId?: string;
  error?: string;
  requiresManualIntervention?: boolean;
  message?: string;
}> {
  try {
    const clean = (str: string) => (str || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanedTargetAuthor = clean(bookData.author);
    const cleanedTargetTitle = clean(bookData.title);

    let targetForeignAuthorId = bookData.foreignAuthorId ? String(bookData.foreignAuthorId).trim() : '';
    let targetForeignBookId = String(bookData.foreignBookId || '').trim();

    // Step 1: ID Resolution & Search Fallback if foreign IDs are missing
    if (!targetForeignAuthorId || !targetForeignBookId) {
      try {
        const searchUrl = `/api/v1/search?term=${encodeURIComponent(`${bookData.title} ${bookData.author}`)}`;
        logger.debug('addBook: Resolving IDs via search fallback', { searchUrl });
        const searchResults = await fetchWithTimeout<any[]>(config, searchUrl);

        const match = searchResults.find((result: any) =>
          result.book &&
          result.book.author &&
          (clean(result.book.author.authorName) === cleanedTargetAuthor ||
            (targetForeignBookId && String(result.book.foreignBookId) === targetForeignBookId))
        );

        if (match?.book) {
          if (!targetForeignBookId && match.book.foreignBookId) {
            targetForeignBookId = String(match.book.foreignBookId);
          }
          if (!targetForeignAuthorId) {
            targetForeignAuthorId = String(
              match.book.author?.foreignAuthorId ||
              match.book.foreignAuthorId ||
              match.author?.foreignAuthorId ||
              ''
            );
          }
        }
      } catch (err) {
        logger.warn('addBook: ID resolution search fallback encountered error', { error: err });
      }
    }

    logger.info('addBook: Checking for existing author in Readarr', {
      author: bookData.author,
      targetForeignAuthorId,
      targetForeignBookId,
    });

    // Step 2: Check if author already exists in Readarr's library
    const libraryAuthors = await getLibraryAuthors(config);
    const existingAuthor = libraryAuthors.find((a: any) =>
      (targetForeignAuthorId && String(a.foreignAuthorId) === targetForeignAuthorId) ||
      clean(a.authorName) === cleanedTargetAuthor
    );

    // =========================================================================
    // BRANCH 1: Author Already Exists in Readarr
    // =========================================================================
    if (existingAuthor) {
      logger.info('addBook [Branch 1]: Author already exists in Readarr', {
        authorId: existingAuthor.id,
        authorName: existingAuthor.authorName,
        foreignAuthorId: existingAuthor.foreignAuthorId,
      });

      // 1. Fetch current author books
      let authorBooks = await getAuthorBooks(config, existingAuthor.id);
      let targetBook = authorBooks.find((b: any) =>
        (targetForeignBookId && String(b.foreignBookId) === targetForeignBookId) ||
        clean(b.title) === cleanedTargetTitle
      );

      // 2. Fallback if book is not yet catalogued:
      // First attempt: Direct addition via POST /api/v1/book using search candidate from Bookshelf.
      // Books below the author's Metadata Profile minPopularity or with unmonitored author settings
      // are filtered out by Readarr's general catalogue sync, but can be added directly.
      if (!targetBook) {
        targetBook = await directAddBookFromSearch(
          config,
          existingAuthor.id,
          targetForeignBookId,
          bookData.title,
          bookData.author
        );
      }

      // Second attempt: Trigger RefreshAuthor and poll
      if (!targetBook) {
        logger.info('addBook [Branch 1]: Book not found in author catalogue, triggering RefreshAuthor', {
          authorId: existingAuthor.id,
          targetForeignBookId,
          title: bookData.title,
        });

        try {
          await refreshAuthor(config, existingAuthor.id);
        } catch (refreshErr) {
          logger.warn('addBook [Branch 1]: RefreshAuthor command dispatch failed', { error: refreshErr });
        }

        // Poll for author catalogue hydration (up to 7 attempts @ 3s interval = ~21s)
        const maxPollAttempts = 7;
        for (let poll = 0; poll < maxPollAttempts; poll++) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          authorBooks = await getAuthorBooks(config, existingAuthor.id);
          targetBook = authorBooks.find((b: any) =>
            (targetForeignBookId && String(b.foreignBookId) === targetForeignBookId) ||
            clean(b.title) === cleanedTargetTitle
          );
          if (targetBook) {
            logger.info('addBook [Branch 1]: Book discovered after author refresh', {
              bookId: targetBook.id,
              foreignBookId: targetBook.foreignBookId,
              pollAttempt: poll + 1,
            });
            break;
          }
        }
      }

      if (!targetBook) {
        logger.error('addBook [Branch 1]: Book not found in author catalogue after refresh', {
          authorId: existingAuthor.id,
          targetForeignBookId,
          title: bookData.title,
        });
        return {
          success: false,
          error: `Book "${bookData.title}" was not found in author catalogue after metadata refresh in Readarr`,
        };
      }

      // 3. Update the book to monitored via dedicated /api/v1/book/monitor (with PUT /api/v1/book/:id fallback)
      logger.info('addBook [Branch 1]: Setting book to monitored', {
        bookId: targetBook.id,
        foreignBookId: targetBook.foreignBookId,
      });

      await setBookMonitored(config, targetBook, existingAuthor, bookData);

      // 4. Trigger targeted search
      try {
        await apiPost(config, '/api/v1/command', {
          name: 'BookSearch',
          bookIds: [targetBook.id],
        });
        logger.info('addBook [Branch 1]: BookSearch command dispatched', { bookId: targetBook.id });
      } catch (searchCmdErr) {
        logger.warn('addBook [Branch 1]: Failed to dispatch BookSearch command', {
          error: searchCmdErr,
          bookId: targetBook.id,
        });
      }

      return {
        success: true,
        bookshelfId: targetBook.id,
        foreignBookId: targetBook.foreignBookId || targetForeignBookId,
      };
    }

    // =========================================================================
    // BRANCH 2: Author Does NOT Exist in Readarr
    // =========================================================================
    logger.info('addBook [Branch 2]: Author does not exist in Readarr, looking up metadata candidate', {
      author: bookData.author,
      targetForeignAuthorId,
    });

    // 1. Lookup author candidates from Readarr's metadata provider (rreading-glasses)
    let lookupCandidates: any[] = [];
    if (targetForeignAuthorId) {
      lookupCandidates = await lookupAuthor(config, `goodreads:${targetForeignAuthorId}`);
    }
    if (!lookupCandidates || lookupCandidates.length === 0) {
      lookupCandidates = await lookupAuthor(config, bookData.author);
    }

    let authorCandidate = lookupCandidates.find((a: any) =>
      (targetForeignAuthorId && String(a.foreignAuthorId) === targetForeignAuthorId) ||
      clean(a.authorName) === cleanedTargetAuthor
    );

    if (!authorCandidate && lookupCandidates.length > 0) {
      authorCandidate = lookupCandidates[0];
    }

    if (!authorCandidate) {
      logger.error('addBook [Branch 2]: No author candidate found in Readarr metadata lookup', {
        author: bookData.author,
        targetForeignAuthorId,
      });
      return {
        success: false,
        error: `Author "${bookData.author}" could not be found via Readarr metadata provider`,
      };
    }

    // 2. Construct author addition payload with unmonitored catalogue defaults
    const authorPayload = {
      ...authorCandidate,
      rootFolderPath: bookData.rootFolderPath,
      qualityProfileId: bookData.qualityProfileId,
      metadataProfileId: authorCandidate.metadataProfileId || 1,
      monitored: true,
      monitorNewItems: 'none', // Critical: Future books discovered via RSS/scans NOT monitored
      addOptions: {
        monitor: 'none', // Critical: All imported existing books NOT monitored
        booksToMonitor: [],
        searchForMissingBooks: false,
      },
    };

    logger.info('addBook [Branch 2]: Adding author to Readarr with unmonitored defaults', {
      authorName: authorPayload.authorName,
      foreignAuthorId: authorPayload.foreignAuthorId,
      monitorNewItems: authorPayload.monitorNewItems,
      monitorOption: authorPayload.addOptions?.monitor,
    });

    const addedAuthor = await addAuthor(config, authorPayload);
    if (!addedAuthor || !addedAuthor.id) {
      logger.error('addBook [Branch 2]: Failed to add author to Readarr', { authorPayload });
      return { success: false, error: 'Failed to add author to Readarr' };
    }

    logger.info('addBook [Branch 2]: Author created in Readarr, polling for catalogue import', {
      authorId: addedAuthor.id,
      authorName: addedAuthor.authorName,
    });

    // 3. Poll for author catalogue to be imported (up to 10 attempts @ 3s interval = ~30s)
    let targetBook: any = null;
    const maxCataloguePolls = 10;
    for (let poll = 0; poll < maxCataloguePolls; poll++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const authorBooks = await getAuthorBooks(config, addedAuthor.id);
      targetBook = authorBooks.find((b: any) =>
        (targetForeignBookId && String(b.foreignBookId) === targetForeignBookId) ||
        clean(b.title) === cleanedTargetTitle
      );
      if (targetBook) {
        logger.info('addBook [Branch 2]: Located requested book in newly added author catalogue', {
          bookId: targetBook.id,
          foreignBookId: targetBook.foreignBookId,
          pollAttempt: poll + 1,
        });
        break;
      }
    }

    // Fallback: If not in author catalogue (e.g. filtered by metadata profile minPopularity), add directly
    if (!targetBook) {
      targetBook = await directAddBookFromSearch(
        config,
        addedAuthor.id,
        targetForeignBookId,
        bookData.title,
        bookData.author
      );
    }

    if (!targetBook) {
      logger.error('addBook [Branch 2]: Requested book not found in catalogue after adding author', {
        authorId: addedAuthor.id,
        targetForeignBookId,
        title: bookData.title,
      });
      return {
        success: false,
        error: `Requested book "${bookData.title}" was not found in author catalogue after importing author to Readarr`,
      };
    }

    // 4. Update the requested book to monitored via dedicated /api/v1/book/monitor (with PUT /api/v1/book/:id fallback)
    logger.info('addBook [Branch 2]: Setting requested book to monitored', {
      bookId: targetBook.id,
      foreignBookId: targetBook.foreignBookId,
    });

    await setBookMonitored(config, targetBook, addedAuthor, bookData);

    // 5. Trigger targeted search
    try {
      await apiPost(config, '/api/v1/command', {
        name: 'BookSearch',
        bookIds: [targetBook.id],
      });
      logger.info('addBook [Branch 2]: BookSearch command dispatched', { bookId: targetBook.id });
    } catch (searchCmdErr) {
      logger.warn('addBook [Branch 2]: Failed to dispatch BookSearch command', {
        error: searchCmdErr,
        bookId: targetBook.id,
      });
    }

    return {
      success: true,
      bookshelfId: targetBook.id,
      foreignBookId: targetBook.foreignBookId || targetForeignBookId,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Bookshelf Connection Timeout' };
    }
    logger.error('addBook: Unexpected error occurred', {
      error: error instanceof Error ? error.message : error,
      bookData,
    });
    return { success: false, error: error.message || 'Unknown error during book addition' };
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

/**
 * Trigger a background book search in Bookshelf
 * @param config - Bookshelf configuration
 * @param bookIds - The book IDs to search for
 */
export async function triggerBookSearch(
  config: BookshelfConfig,
  bookIds: number[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `/api/v1/command`;
    logger.debug('Triggering BookSearch command in Bookshelf', { url, bookIds });

    await fetchWithTimeout<any>(config, url, {
      method: 'POST',
      body: JSON.stringify({
        name: 'BookSearch',
        bookIds
      }),
    });

    return { success: true };
  } catch (error: any) {
    if (error.name === 'AbortError') return { success: false, error: 'Bookshelf Connection Timeout' };
    logger.error('Failed to trigger book search in Bookshelf', { error: error instanceof Error ? error.message : error, bookIds });
    return { success: false, error: error.message };
  }
}

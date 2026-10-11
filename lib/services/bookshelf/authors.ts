import type { BookshelfConfig } from '@/types/bookshelf.types';
import { apiGet, apiPost, fetchWithTimeout } from './api';
import { logger } from '@/lib/utils/logger';

/**
 * Fetch all authors currently existing in Bookshelf's local library.
 */
export async function getLibraryAuthors(config: BookshelfConfig): Promise<any[]> {
  try {
    return await apiGet<any[]>(config, '/api/v1/author');
  } catch (error) {
    logger.error('Failed to get library authors from Bookshelf', {
      error: error instanceof Error ? error.message : error,
    });
    return [];
  }
}

/**
 * Lookup author candidates in Bookshelf's metadata provider (rreading-glasses)
 * by term (e.g. author name or "goodreads:<id>").
 */
export async function lookupAuthor(
  config: BookshelfConfig,
  term: string
): Promise<any[]> {
  try {
    const url = `/api/v1/author/lookup?term=${encodeURIComponent(term)}`;
    logger.debug('Looking up author in Bookshelf', { url, term });
    const results = await fetchWithTimeout<any[]>(config, url);
    return Array.isArray(results) ? results : [];
  } catch (error) {
    logger.error('Failed to lookup author in Bookshelf', {
      error: error instanceof Error ? error.message : error,
      term,
    });
    return [];
  }
}

/**
 * Add a new author to Bookshelf (Readarr) with specified configuration.
 */
export async function addAuthor(
  config: BookshelfConfig,
  payload: any
): Promise<any> {
  try {
    logger.info('Adding author to Bookshelf', {
      authorName: payload?.authorName,
      foreignAuthorId: payload?.foreignAuthorId,
    });
    const result = await apiPost<any>(config, '/api/v1/author', payload);
    logger.info('Successfully added author to Bookshelf', {
      id: result?.id,
      authorName: result?.authorName,
      foreignAuthorId: result?.foreignAuthorId,
    });
    return result;
  } catch (error) {
    logger.error('Failed to add author to Bookshelf', {
      error: error instanceof Error ? error.message : error,
      authorName: payload?.authorName,
      foreignAuthorId: payload?.foreignAuthorId,
    });
    throw error;
  }
}

/**
 * Trigger a background RefreshAuthor command in Bookshelf (Readarr)
 * to sync metadata / book catalogue for an existing author.
 */
export async function refreshAuthor(
  config: BookshelfConfig,
  authorId: number
): Promise<any> {
  try {
    logger.info('Triggering RefreshAuthor command in Bookshelf', { authorId });
    const result = await apiPost<any>(config, '/api/v1/command', {
      name: 'RefreshAuthor',
      authorId,
    });
    logger.debug('RefreshAuthor command dispatched successfully', {
      commandId: result?.id,
      status: result?.status,
      authorId,
    });
    return result;
  } catch (error) {
    logger.error('Failed to trigger RefreshAuthor in Bookshelf', {
      error: error instanceof Error ? error.message : error,
      authorId,
    });
    throw error;
  }
}

/**
 * Fetch all books belonging to a specific author from Bookshelf.
 */
export async function getAuthorBooks(
  config: BookshelfConfig,
  authorId: number
): Promise<any[]> {
  try {
    const url = `/api/v1/book?authorId=${authorId}`;
    logger.debug('Fetching books for author from Bookshelf', { url, authorId });
    const books = await apiGet<any[]>(config, url);
    return Array.isArray(books) ? books : [];
  } catch (error) {
    logger.error('Failed to get author books from Bookshelf', {
      error: error instanceof Error ? error.message : error,
      authorId,
    });
    return [];
  }
}

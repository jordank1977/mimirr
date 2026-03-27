/**
 * BookshelfService - Facade Pattern
 * 
 * This service maintains the original API footprint by delegating
 * all methods to the new submodule implementations in ./bookshelf/
 */

import { logger } from '@/lib/utils/logger'
import type { BookshelfConfig, QualityProfile } from '@/types/bookshelf.types'

// Import submodule functions
import * as BooksAPI from './bookshelf/books'
import * as AuthorsAPI from './bookshelf/authors'
import * as QualityProfilesAPI from './bookshelf/quality-profiles'
import * as CacheAPI from './bookshelf/cache'

export class BookshelfService {
  // ============================================================
  // Connection & API
  // ============================================================

  /**
   * Test connection to Bookshelf
   */
  static async testConnection(config: BookshelfConfig): Promise<boolean> {
    try {
      const response = await fetch(`${config.url}/api/v3/system/status`, {
        headers: {
          'X-Api-Key': config.apiKey,
        },
      })

      return response.ok
    } catch (error) {
      logger.error('Bookshelf connection test failed', { error })
      return false
    }
  }

  // ============================================================
  // Books API (delegated to ./bookshelf/books.ts)
  // ============================================================

  static checkBookInLibrary = BooksAPI.checkBookInLibrary
  static getLibraryBooks = BooksAPI.getLibraryBooks
  static getBook = BooksAPI.getBook
  static getBookEditions = BooksAPI.getBookEditions
  static getLibraryAuthors = AuthorsAPI.getLibraryAuthors
  static lookupAuthor = BooksAPI.lookupAuthor
  static searchBooks = BooksAPI.searchBooks
  static triggerBookSearch = BooksAPI.triggerBookSearch
  static getRootFolders = BooksAPI.getRootFolders
  static addBook = BooksAPI.addBook
  static getAuthorBookStatus = BooksAPI.getAuthorBookStatus

  // ============================================================
  // Quality Profiles API (delegated to ./bookshelf/quality-profiles.ts)
  // ============================================================

  static getQualityProfiles = QualityProfilesAPI.getQualityProfiles
  static syncQualityProfiles = QualityProfilesAPI.syncQualityProfiles
  static getQualityProfileConfigs = QualityProfilesAPI.getQualityProfileConfigs
  static getEnabledQualityProfiles = QualityProfilesAPI.getEnabledQualityProfiles
  static updateQualityProfileConfig = QualityProfilesAPI.updateQualityProfileConfig
  static reorderQualityProfiles = QualityProfilesAPI.reorderQualityProfiles

  // ============================================================
  // Cache API (delegated to ./bookshelf/cache.ts)
  // ============================================================

  static invalidateLibraryCache = CacheAPI.invalidateLibraryCache
  static getCacheStatus = CacheAPI.getCacheStatus
}

// ============================================================
// Re-export types for backward compatibility with existing imports
// e.g., import { BookshelfConfig } from '@/lib/services/bookshelf.service'
// ============================================================

export type { BookshelfConfig, QualityProfile } from '@/types/bookshelf.types'

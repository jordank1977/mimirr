import type { BookshelfConfig } from '@/types/bookshelf.types';
import { apiGet } from './api';
import { logger } from '@/lib/utils/logger';

export async function getLibraryAuthors(config: BookshelfConfig): Promise<any[]> {
  try {
    return await apiGet<any[]>(config, '/api/v1/author');
  } catch (error) {
    logger.error('Failed to get library authors from Bookshelf', { error });
    return [];
  }
}

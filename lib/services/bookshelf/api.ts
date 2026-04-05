import { BookshelfConfig } from '@/types/bookshelf.types';
import { logger } from '@/lib/utils/logger';

const DEFAULT_TIMEOUT = 60000;

/**
 * Universal fetch wrapper for Bookshelf (Readarr) API calls.
 * Includes automatic timeout via AbortController and X-Api-Key injection.
 */
export async function fetchWithTimeout<T>(
  config: BookshelfConfig,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  const url = `${config.url.replace(/\/$/, '')}${endpoint}`;

  try {
    logger.trace('Outgoing Bookshelf API Request', { url, method: options.method || 'GET' });
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.apiKey,
        ...options.headers,
      },
    });

    logger.trace('Bookshelf API Response', { url, status: response.status });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Authentication failed: Invalid API key');
      }
      throw new Error(`Bookshelf API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('Bookshelf API Request Timed Out', { url, timeout: DEFAULT_TIMEOUT });
    } else {
      logger.error('Bookshelf API Request Failed', { url, error: error instanceof Error ? error.message : error });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * GET request helper
 */
export async function apiGet<T>(
  config: BookshelfConfig,
  endpoint: string
): Promise<T> {
  return fetchWithTimeout<T>(config, endpoint, { method: 'GET' });
}

/**
 * POST request helper
 */
export async function apiPost<T>(
  config: BookshelfConfig,
  endpoint: string,
  body: unknown
): Promise<T> {
  return fetchWithTimeout<T>(config, endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PUT request helper
 */
export async function apiPut<T>(
  config: BookshelfConfig,
  endpoint: string,
  body: unknown
): Promise<T> {
  return fetchWithTimeout<T>(config, endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request helper
 */
export async function apiDelete<T>(
  config: BookshelfConfig,
  endpoint: string
): Promise<T> {
  return fetchWithTimeout<T>(config, endpoint, { method: 'DELETE' });
}
